package main

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// Structure holds metadata for a data structure card and page.
type Structure struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	EnglishName string `json:"englishName"`
	Category    string `json:"category"`
	Description string `json:"description"`
	SearchBig0  string `json:"searchBigO"` // summary for the card
	InsertBig0  string `json:"insertBigO"`
	UpdateBig0  string `json:"updateBigO"`
	Available   bool   `json:"available"`
}

// registry lists every structure the application knows about.
// To add a new structure: append an entry here, create the JSON file and JS file.
var registry = []Structure{
	{ID: "array", Name: "Array Estático", EnglishName: "Static Array", Category: "Linear", SearchBig0: "O(n)", InsertBig0: "O(n)", UpdateBig0: "O(1)", Available: true},
	{ID: "singly-linked-list", Name: "Lista Encadeada Simples", EnglishName: "Singly Linked List", Category: "Linear Encadeada", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: true},
	{ID: "doubly-linked-list", Name: "Lista Encadeada Dupla", EnglishName: "Doubly Linked List", Category: "Linear Encadeada", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: true},
	{ID: "circular-list", Name: "Lista Circular", EnglishName: "Circular Linked List", Category: "Linear Encadeada", SearchBig0: "O(n)", InsertBig0: "O(n)", UpdateBig0: "O(n)", Available: true},
	// Future structures - set Available: false until implemented
	{ID: "stack", Name: "Pilha (Stack)", EnglishName: "Stack", Category: "Linear", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "queue", Name: "Fila (Queue)", EnglishName: "Queue", Category: "Linear", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "circular-queue", Name: "Fila Circular", EnglishName: "Circular Queue", Category: "Linear", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "deque", Name: "Deque", EnglishName: "Deque", Category: "Linear", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "binary-search-tree", Name: "Árvore Binária de Busca", EnglishName: "Binary Search Tree", Category: "Árvore", SearchBig0: "O(log n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "avl-tree", Name: "Árvore AVL", EnglishName: "AVL Tree", Category: "Árvore", SearchBig0: "O(log n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "heap", Name: "Heap (Min/Max)", EnglishName: "Heap", Category: "Árvore", SearchBig0: "O(n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "hash-table", Name: "Tabela Hash", EnglishName: "Hash Table", Category: "Hash", SearchBig0: "O(1)", InsertBig0: "O(1)", UpdateBig0: "O(1)", Available: false},
	{ID: "graph", Name: "Grafo", EnglishName: "Graph", Category: "Grafo", SearchBig0: "O(V+E)", InsertBig0: "O(1)", UpdateBig0: "O(1)", Available: false},
	{ID: "trie", Name: "Trie", EnglishName: "Trie", Category: "Árvore", SearchBig0: "O(m)", InsertBig0: "O(m)", UpdateBig0: "O(m)", Available: false},
}

var templates map[string]*template.Template

func main() {
	var err error
	templates, err = loadTemplates()
	if err != nil {
		log.Fatalf("parsing templates: %v", err)
	}

	mux := http.NewServeMux()

	// Static files
	fs := http.FileServer(http.Dir("web/static"))
	mux.Handle("/static/", http.StripPrefix("/static/", fs))

	// Pages
	mux.HandleFunc("GET /{$}", handleHome)
	mux.HandleFunc("GET /structure/{id}", handleStructure)
	mux.HandleFunc("GET /compare", handleCompare)

	// API
	mux.HandleFunc("GET /api/structures", handleAPIStructures)
	mux.HandleFunc("GET /api/structure/{id}", handleAPIStructure)

	log.Println("ds-explorer listening on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}

func loadTemplates() (map[string]*template.Template, error) {
	pages := []string{"home.html", "structure.html", "compare.html"}
	loaded := make(map[string]*template.Template, len(pages))
	funcs := template.FuncMap{
		"complexityClass":   complexityClass,
		"complexityTooltip": complexityTooltip,
	}

	for _, page := range pages {
		tmpl, err := template.New("base").Funcs(funcs).ParseFiles(
			filepath.Join("web", "templates", "base.html"),
			filepath.Join("web", "templates", page),
		)
		if err != nil {
			return nil, err
		}
		loaded[page] = tmpl
	}

	return loaded, nil
}

func complexityClass(value string) string {
	switch strings.TrimSpace(value) {
	case "O(1)", "O(log n)":
		return "card-complexity--excellent"
	case "O(n)", "O(m)", "O(V+E)":
		return "card-complexity--good"
	case "O(n log n)":
		return "card-complexity--fair"
	case "O(n^2)", "O(n²)":
		return "card-complexity--warning"
	case "O(2^n)", "O(n!)":
		return "card-complexity--danger"
	default:
		return "card-complexity--neutral"
	}
}

func complexityTooltip(value string) string {
	switch strings.TrimSpace(value) {
	case "O(1)":
		return "Constante: o custo praticamente nao cresce com a quantidade de dados."
	case "O(log n)":
		return "Logaritmica: cresce bem devagar, mesmo quando a entrada aumenta muito."
	case "O(n)":
		return "Linear: o custo cresce aproximadamente na mesma proporcao do tamanho da entrada."
	case "O(m)":
		return "Linear no tamanho da chave ou sequencia analisada."
	case "O(V+E)":
		return "Linear em vertices e arestas: percorre o grafo sem explosao combinatoria."
	case "O(n log n)":
		return "Quase linear: eficiente, mas ja cresce mais que uma passagem simples."
	case "O(n^2)", "O(n²)":
		return "Quadratica: o custo cresce rapido e pesa em entradas maiores."
	case "O(2^n)":
		return "Exponencial: cresce muito rapido e fica inviavel cedo."
	case "O(n!)":
		return "Fatorial: explosao combinatoria severa, pior desempenho para entradas maiores."
	default:
		return "Notacao assintotica que indica como o custo cresce conforme a entrada aumenta."
	}
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	if err := templates["home.html"].ExecuteTemplate(w, "home.html", registry); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
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

	// Pass raw JSON as template.JS so the template can embed it safely.
	type pageData struct {
		ID      string
		Payload template.JS
	}
	if err := templates["structure.html"].ExecuteTemplate(w, "structure.html", pageData{
		ID:      id,
		Payload: template.JS(data),
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func handleCompare(w http.ResponseWriter, r *http.Request) {
	if err := templates["compare.html"].ExecuteTemplate(w, "compare.html", nil); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func handleAPIStructures(w http.ResponseWriter, r *http.Request) {
	renderJSON(w, registry)
}

func handleAPIStructure(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	data, err := loadStructureJSON(id)
	if err != nil {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

// loadStructureJSON reads content/structures/{id}.json from disk.
func loadStructureJSON(id string) ([]byte, error) {
	// Sanitise id to prevent path traversal
	id = filepath.Base(strings.ReplaceAll(id, "..", ""))
	path := filepath.Join("content", "structures", id+".json")
	return os.ReadFile(path)
}

func isKnownID(id string) bool {
	for _, s := range registry {
		if s.ID == id {
			return true
		}
	}
	return false
}

// renderJSON is a helper used by the API handler to write typed structs.
func renderJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}
