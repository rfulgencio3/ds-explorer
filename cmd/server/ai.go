package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// geminiAPIKey is read once at startup. An empty string disables the Ada IA feature.
var geminiAPIKey = os.Getenv("GEMINI_API_KEY")

// geminiModel is configurable via GEMINI_MODEL env var.
// Default: gemini-2.5-flash (stable, free tier, v1beta).
var geminiModel = func() string {
	if m := os.Getenv("GEMINI_MODEL"); m != "" {
		return m
	}
	return "gemini-2.5-flash"
}()

// geminiEndpoint builds the Gemini REST endpoint for the configured model.
func geminiEndpoint() string {
	return "https://generativelanguage.googleapis.com/v1beta/models/" + geminiModel + ":generateContent"
}

// maxQuestionBytes is the maximum allowed size (in bytes) for a user question.
const maxQuestionBytes = 512

// ── Request / Response types ───────────────────────────────────────────────

type aiAskRequest struct {
	Question    string `json:"question"`
	StructureID string `json:"structureId"`
}

type aiAskResponse struct {
	Answer string `json:"answer,omitempty"`
	Error  string `json:"error,omitempty"`
}

// ── Rate limiter ───────────────────────────────────────────────────────────

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string]time.Time
	window  time.Duration
}

var aiRateLimiter = &rateLimiter{
	entries: make(map[string]time.Time),
	window:  time.Minute,
}

// allow returns true if the IP has not sent a request within the window.
// Stale entries are purged lazily on each call.
func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	for k, t := range rl.entries {
		if now.Sub(t) > rl.window {
			delete(rl.entries, k)
		}
	}

	if last, exists := rl.entries[ip]; exists && now.Sub(last) < rl.window {
		return false
	}
	rl.entries[ip] = now
	return true
}

// ── IP helper ──────────────────────────────────────────────────────────────

// clientIP extracts the real client IP, respecting reverse-proxy headers.
func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return strings.TrimSpace(ip)
	}
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return strings.TrimSpace(strings.SplitN(fwd, ",", 2)[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ── Page contexts (non-structure pages that support Ada IA) ────────────────

// pageContexts maps page IDs to their topic description for Ada IA.
// These are validated via allowlist — same security model as isKnownID.
var pageContexts = map[string]string{
	"memory-hierarchy": "hierarquia de memória (L1/L2/L3/RAM, localidade de cache, alocação e desalocação de memória em C, C++, Go, .NET, Java, Python e Rust)",
	"big-o":            "notação assintótica Big-O (O(1), O(log n), O(n), O(n log n), O(n²), O(2^n), O(n!)), análise de complexidade de tempo e espaço, e comparação de crescimento de funções",
}

// buildPageSystemPrompt builds the Ada IA system prompt for a non-structure guide page.
func buildPageSystemPrompt(pageDesc string) string {
	var sb strings.Builder
	sb.WriteString("Você é Ada IA, uma assistente educacional simpática e descontraída, ")
	sb.WriteString("criada em homenagem a Ada Lovelace — a primeira programadora da história. ")
	sb.WriteString("Responda SEMPRE em português do Brasil, de forma clara, acolhedora e didática. ")
	sb.WriteString("Use linguagem acessível, com exemplos práticos quando pertinente. ")
	fmt.Fprintf(&sb, "O aluno está estudando: %s. ", pageDesc)
	sb.WriteString("Foque exclusivamente neste tema. Não responda sobre outros assuntos.\n")
	return sb.String()
}

// ── System prompt ──────────────────────────────────────────────────────────

// buildSystemPrompt builds the Ada IA system prompt with context from the structure JSON.
func buildSystemPrompt(structData map[string]any) string {
	name, _ := structData["name"].(string)
	category, _ := structData["category"].(string)
	description, _ := structData["description"].(string)

	var complexitySummary string
	if c, ok := structData["complexity"].(map[string]any); ok {
		parts := []string{}
		if a, ok := c["access"].(map[string]any); ok {
			if w, ok := a["worst"].(string); ok {
				parts = append(parts, fmt.Sprintf("acesso pior caso %s", w))
			}
		}
		if s, ok := c["search"].(map[string]any); ok {
			if w, ok := s["worst"].(string); ok {
				parts = append(parts, fmt.Sprintf("busca pior caso %s", w))
			}
		}
		if len(parts) > 0 {
			complexitySummary = strings.Join(parts, ", ")
		}
	}

	var sb strings.Builder
	sb.WriteString("Você é Ada IA, uma assistente educacional simpática e descontraída, ")
	sb.WriteString("criada em homenagem a Ada Lovelace — a primeira programadora da história. ")
	sb.WriteString("Responda SEMPRE em português do Brasil, de forma clara, acolhedora e didática. ")
	sb.WriteString("Use linguagem acessível, com exemplos práticos quando pertinente. ")
	sb.WriteString("Foque exclusivamente na estrutura de dados que está sendo estudada. ")
	sb.WriteString("Não responda sobre outros assuntos.\n\n")
	sb.WriteString("Estrutura de dados atual:\n")
	fmt.Fprintf(&sb, "- Nome: %s\n", name)
	fmt.Fprintf(&sb, "- Categoria: %s\n", category)
	fmt.Fprintf(&sb, "- Descrição: %s\n", description)
	if complexitySummary != "" {
		fmt.Fprintf(&sb, "- Complexidade resumida: %s\n", complexitySummary)
	}
	return sb.String()
}

// ── Gemini API call ────────────────────────────────────────────────────────

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

// callGemini sends the question to the Gemini Flash REST API and returns the answer text.
// The system prompt is prepended to the user message — compatible with the stable v1 API.
func callGemini(systemPrompt, question string) (string, error) {
	combined := systemPrompt + "\n\nPergunta do aluno: " + question
	payload := geminiRequest{
		Contents: []geminiContent{{Role: "user", Parts: []geminiPart{{Text: combined}}}},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal: %w", err)
	}

	url := fmt.Sprintf("%s?key=%s", geminiEndpoint(), geminiAPIKey)
	resp, err := http.Post(url, "application/json", bytes.NewReader(body)) //nolint:noctx
	if err != nil {
		return "", fmt.Errorf("http post: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		var errBody struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.Unmarshal(raw, &errBody)
		msg := errBody.Error.Message
		if msg == "" {
			msg = string(raw)
		}
		return "", fmt.Errorf("gemini API status %d: %s", resp.StatusCode, msg)
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode: %w", err)
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}
	return result.Candidates[0].Content.Parts[0].Text, nil
}

// ── Diagnóstico: listar modelos disponíveis ─────────────────────────────────

// handleAIModels chama a ListModels API do Gemini e loga os modelos disponíveis.
// Endpoint: GET /api/ai/models — apenas para diagnóstico, não expõe a API key.
func handleAIModels(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if geminiAPIKey == "" {
		http.Error(w, `{"error":"GEMINI_API_KEY not set"}`, http.StatusServiceUnavailable)
		return
	}
	url := "https://generativelanguage.googleapis.com/v1beta/models?key=" + geminiAPIKey
	resp, err := http.Get(url) //nolint:noctx
	if err != nil {
		http.Error(w, `{"error":"failed to contact Gemini"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	log.Printf("handleAIModels: status=%d body=%s", resp.StatusCode, string(raw))
	w.WriteHeader(resp.StatusCode)
	w.Write(raw) //nolint:errcheck
}

// ── Handler ────────────────────────────────────────────────────────────────

func handleAIAsk(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Feature gate
	if geminiAPIKey == "" {
		log.Printf("handleAIAsk: GEMINI_API_KEY not set (model=%s)", geminiModel)
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(aiAskResponse{Error: "Ada IA não está configurada no momento"})
		return
	}

	// Rate limit
	if !aiRateLimiter.allow(clientIP(r)) {
		w.WriteHeader(http.StatusTooManyRequests)
		json.NewEncoder(w).Encode(aiAskResponse{Error: "aguarde 1 minuto entre perguntas"})
		return
	}

	// Decode body (capped at 2 KB)
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	var req aiAskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(aiAskResponse{Error: "requisição inválida"})
		return
	}

	// Validate contextId via allowlist — accepts structure IDs and page context IDs
	if !isKnownID(req.StructureID) {
		if _, ok := pageContexts[req.StructureID]; !ok {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(aiAskResponse{Error: "contexto inválido"})
			return
		}
	}

	// Validate question
	question := strings.TrimSpace(req.Question)
	if question == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(aiAskResponse{Error: "pergunta não pode ser vazia"})
		return
	}
	if len(question) > maxQuestionBytes {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(aiAskResponse{Error: "pergunta muito longa (máximo 512 caracteres)"})
		return
	}

	// Build system prompt — structure pages load JSON; guide pages use inline context
	var systemPrompt string
	if isKnownID(req.StructureID) {
		rawJSON, err := loadStructureJSON(req.StructureID)
		if err != nil {
			log.Printf("handleAIAsk: loadStructureJSON(%s): %v", req.StructureID, err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(aiAskResponse{Error: "erro interno"})
			return
		}
		var structData map[string]any
		if err := json.Unmarshal(rawJSON, &structData); err != nil {
			log.Printf("handleAIAsk: unmarshal structData: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(aiAskResponse{Error: "erro interno"})
			return
		}
		systemPrompt = buildSystemPrompt(structData)
	} else {
		systemPrompt = buildPageSystemPrompt(pageContexts[req.StructureID])
	}

	// Call Gemini
	answer, err := callGemini(systemPrompt, question)
	if err != nil {
		log.Printf("handleAIAsk: callGemini: %v", err)
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(aiAskResponse{Error: "erro ao consultar a Ada IA. Tente novamente."})
		return
	}

	json.NewEncoder(w).Encode(aiAskResponse{Answer: answer})
}
