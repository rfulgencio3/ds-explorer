package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

var (
	templatesMu   sync.RWMutex
	templates     map[string]*template.Template
	devLiveReload = os.Getenv("DS_DEV_LIVE_RELOAD") == "1"
)

// complexityClassMap maps Big-O notation to the CSS modifier class used on cards.
// To add a new complexity level: add one entry here — no function changes needed.
var complexityClassMap = map[string]string{
	"O(1)":      "card-complexity--excellent",
	"O(log n)":  "card-complexity--excellent",
	"O(n)":      "card-complexity--good",
	"O(m)":      "card-complexity--good",
	"O(V+E)":    "card-complexity--good",
	"O(n log n)": "card-complexity--fair",
	"O(n^2)":    "card-complexity--warning",
	"O(n²)":     "card-complexity--warning",
	"O(2^n)":    "card-complexity--danger",
	"O(n!)":     "card-complexity--danger",
}

// complexityTooltipMap maps Big-O notation to a human-readable description.
var complexityTooltipMap = map[string]string{
	"O(1)":      "Constante: o custo praticamente nao cresce com a quantidade de dados.",
	"O(log n)":  "Logaritmica: cresce bem devagar, mesmo quando a entrada aumenta muito.",
	"O(n)":      "Linear: o custo cresce aproximadamente na mesma proporcao do tamanho da entrada.",
	"O(m)":      "Linear no tamanho da chave ou sequencia analisada.",
	"O(V+E)":    "Linear em vertices e arestas: percorre o grafo sem explosao combinatoria.",
	"O(n log n)": "Quase linear: eficiente, mas ja cresce mais que uma passagem simples.",
	"O(n^2)":    "Quadratica: o custo cresce rapido e pesa em entradas maiores.",
	"O(n²)":     "Quadratica: o custo cresce rapido e pesa em entradas maiores.",
	"O(2^n)":    "Exponencial: cresce muito rapido e fica inviavel cedo.",
	"O(n!)":     "Fatorial: explosao combinatoria severa, pior desempenho para entradas maiores.",
}

func complexityClass(value string) string {
	if c, ok := complexityClassMap[strings.TrimSpace(value)]; ok {
		return c
	}
	return "card-complexity--neutral"
}

func complexityTooltip(value string) string {
	if t, ok := complexityTooltipMap[strings.TrimSpace(value)]; ok {
		return t
	}
	return "Notacao assintotica que indica como o custo cresce conforme a entrada aumenta."
}

func loadTemplates() (map[string]*template.Template, error) {
	pages := []string{"home.html", "structure.html", "compare.html", "references.html", "big_o.html", "memory_hierarchy.html"}
	loaded := make(map[string]*template.Template, len(pages))

	for _, page := range pages {
		tmpl, err := parseTemplate(page)
		if err != nil {
			return nil, err
		}
		loaded[page] = tmpl
	}

	return loaded, nil
}

func parseTemplate(page string) (*template.Template, error) {
	return template.New("base").Funcs(template.FuncMap{
		"complexityClass":   complexityClass,
		"complexityTooltip": complexityTooltip,
		"devLiveReload":     func() bool { return devLiveReload },
		"assetURL":          assetURL,
		"navGroups":         navGroups,
	}).ParseFiles(
		filepath.Join("web", "templates", "base.html"),
		filepath.Join("web", "templates", page),
	)
}

func getTemplate(page string) (*template.Template, error) {
	if devLiveReload {
		return parseTemplate(page)
	}
	templatesMu.RLock()
	tmpl, ok := templates[page]
	templatesMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("template %s not loaded", page)
	}
	return tmpl, nil
}

func renderPage(w http.ResponseWriter, page string, data any) {
	tmpl, err := getTemplate(page)
	if err != nil {
		log.Printf("renderPage: getTemplate(%s): %v", page, err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	if err := tmpl.ExecuteTemplate(w, page, data); err != nil {
		log.Printf("renderPage: ExecuteTemplate(%s): %v", page, err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
	}
}

// renderJSON writes v as JSON to w.
func renderJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func assetURL(path string) string {
	if !devLiveReload {
		return path
	}
	return fmt.Sprintf("%s?v=%d", path, liveReloadState.Version())
}
