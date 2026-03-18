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
	Category    string `json:"category"`
	Description string `json:"description"`
	SearchBig0  string `json:"searchBigO"` // summary for the card
	Available   bool   `json:"available"`
}

// registry lists every structure the application knows about.
// To add a new structure: append an entry here, create the JSON file and JS file.
var registry = []Structure{
	{ID: "array", Name: "Array Estático", Category: "Linear", SearchBig0: "O(n)", Available: true},
	{ID: "singly-linked-list", Name: "Lista Encadeada Simples", Category: "Linear Encadeada", SearchBig0: "O(n)", Available: true},
	{ID: "doubly-linked-list", Name: "Lista Encadeada Dupla", Category: "Linear Encadeada", SearchBig0: "O(n)", Available: true},
	// Future structures — set Available: false until implemented
	{ID: "stack", Name: "Pilha (Stack)", Category: "Linear", SearchBig0: "O(n)", Available: false},
	{ID: "queue", Name: "Fila (Queue)", Category: "Linear", SearchBig0: "O(n)", Available: false},
	{ID: "binary-tree", Name: "Árvore Binária", Category: "Árvore", SearchBig0: "O(log n)", Available: false},
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
	mux.HandleFunc("GET /api/structure/{id}", handleAPIStructure)

	log.Println("ds-explorer listening on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}

func loadTemplates() (map[string]*template.Template, error) {
	pages := []string{"home.html", "structure.html", "compare.html"}
	loaded := make(map[string]*template.Template, len(pages))

	for _, page := range pages {
		tmpl, err := template.ParseFiles(
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
