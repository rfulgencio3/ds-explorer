package main

import (
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	var err error

	loaded, err := loadTemplates()
	if err != nil {
		log.Fatalf("parsing templates: %v", err)
	}

	templatesMu.Lock()
	templates = loaded
	templatesMu.Unlock()

	if devLiveReload {
		go watchLiveReloadChanges([]string{
			filepath.Join("web", "templates"),
			filepath.Join("web", "static"),
			filepath.Join("content", "structures"),
		}, 700*time.Millisecond)
		log.Println("live reload enabled (set DS_DEV_LIVE_RELOAD=1)")
	}

	mux := http.NewServeMux()

	// Static files
	fileServer := http.FileServer(http.Dir("web/static"))
	mux.Handle("/static/", http.StripPrefix("/static/", fileServer))

	// Dev utilities
	if devLiveReload {
		mux.HandleFunc("GET /__live-reload", handleLiveReload)
	}

	// Pages
	mux.HandleFunc("GET /{$}", handleHome)
	mux.HandleFunc("GET /structure/{id}", handleStructure)
	mux.HandleFunc("GET /compare", handleCompare)
	mux.HandleFunc("GET /big-o", handleBigO)
	mux.HandleFunc("GET /memory-hierarchy", handleMemoryHierarchy)
	mux.HandleFunc("GET /references", handleReferences)

	// API
	mux.HandleFunc("GET /api/structures", handleAPIStructures)
	mux.HandleFunc("GET /api/structure/{id}", handleAPIStructure)
	mux.HandleFunc("POST /api/ai/ask", handleAIAsk)

	addr := serverAddr()
	log.Printf("ds-explorer listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, securityHeaders(mux)))
}

// securityHeaders wraps h and sets defensive HTTP response headers on every response.
func securityHeaders(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		h.ServeHTTP(w, r)
	})
}

func serverAddr() string {
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}
	if strings.HasPrefix(port, ":") {
		return port
	}
	return ":" + port
}

// ── Page handlers ──────────────────────────────────────────────────────────

func handleHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	renderPage(w, "home.html", registry)
}

func handleStructure(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !isKnownID(id) {
		http.NotFound(w, r)
		return
	}

	data, err := loadStructureJSON(id)
	if err != nil {
		http.Error(w, "estrutura não encontrada", http.StatusNotFound)
		return
	}

	type pageData struct {
		ID      string
		Payload template.JS
	}
	renderPage(w, "structure.html", pageData{
		ID:      id,
		Payload: template.JS(data),
	})
}

func handleCompare(w http.ResponseWriter, r *http.Request) {
	renderPage(w, "compare.html", nil)
}

func handleBigO(w http.ResponseWriter, r *http.Request) {
	renderPage(w, "big_o.html", nil)
}

func handleMemoryHierarchy(w http.ResponseWriter, r *http.Request) {
	renderPage(w, "memory_hierarchy.html", nil)
}

func handleReferences(w http.ResponseWriter, r *http.Request) {
	renderPage(w, "references.html", registry)
}

// ── API handlers ───────────────────────────────────────────────────────────

func handleAPIStructures(w http.ResponseWriter, r *http.Request) {
	renderJSON(w, registry)
}

func handleAPIStructure(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	// Guard: reject any id not in the known registry (prevents path traversal).
	if !isKnownID(id) {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	data, err := loadStructureJSON(id)
	if err != nil {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// ── Dev utilities ──────────────────────────────────────────────────────────

func handleLiveReload(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch, unregister := liveReloadState.Subscribe()
	defer unregister()

	fmt.Fprintf(w, "data: %d\n\n", liveReloadState.Version())
	flusher.Flush()

	for {
		select {
		case version := <-ch:
			fmt.Fprintf(w, "data: %d\n\n", version)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}
