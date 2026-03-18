package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Structure holds metadata for a data structure card and page.
type Structure struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	EnglishName    string `json:"englishName"`
	Category       string `json:"category"`
	Subtype        string `json:"subtype"`
	DotNetName     string `json:"dotNetName"`
	Implementation string `json:"implementation"`
	Description    string `json:"description"`
	SearchBig0     string `json:"searchBigO"` // summary for the card
	InsertBig0     string `json:"insertBigO"`
	UpdateBig0     string `json:"updateBigO"`
	Available      bool   `json:"available"`
}

type navGroup struct {
	Category string
	Items    []Structure
}

// registry lists every structure the application knows about.
// To add a new structure: append an entry here, create the JSON file and JS file.
var registry = []Structure{
	{ID: "array", Name: "Array Estático", EnglishName: "Static Array", Category: "Linear", Subtype: "Sequencial", DotNetName: "T[]", Implementation: "array contíguo fixo", SearchBig0: "O(n)", InsertBig0: "O(n)", UpdateBig0: "O(1)", Available: true},
	{ID: "singly-linked-list", Name: "Lista Encadeada Simples", EnglishName: "Singly Linked List", Category: "Linear", Subtype: "Encadeada", DotNetName: "custom SinglyLinkedList", Implementation: "nós com next", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: true},
	{ID: "doubly-linked-list", Name: "Lista Encadeada Dupla", EnglishName: "Doubly Linked List", Category: "Linear", Subtype: "Encadeada", DotNetName: "LinkedList<T>", Implementation: "lista duplamente encadeada", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: true},
	{ID: "circular-list", Name: "Lista Circular", EnglishName: "Circular Linked List", Category: "Linear", Subtype: "Encadeada", DotNetName: "custom CircularList", Implementation: "lista encadeada circular", SearchBig0: "O(n)", InsertBig0: "O(n)", UpdateBig0: "O(n)", Available: true},
	// Future structures - set Available: false until implemented
	{ID: "stack", Name: "Pilha (Stack)", EnglishName: "Stack", Category: "Linear", Subtype: "Restrita", DotNetName: "Stack<T>", Implementation: "coleção LIFO", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "queue", Name: "Fila (Queue)", EnglishName: "Queue", Category: "Linear", Subtype: "Restrita", DotNetName: "Queue<T>", Implementation: "coleção FIFO", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "circular-queue", Name: "Fila Circular", EnglishName: "Circular Queue", Category: "Linear", Subtype: "Restrita", DotNetName: "custom CircularQueue", Implementation: "buffer circular", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "deque", Name: "Deque", EnglishName: "Deque", Category: "Linear", Subtype: "Restrita", DotNetName: "custom Deque", Implementation: "duas extremidades", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "binary-search-tree", Name: "Árvore Binária de Busca", EnglishName: "Binary Search Tree", Category: "Árvore", DotNetName: "custom BinarySearchTree", Implementation: "árvore binária ordenada", SearchBig0: "O(log n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "avl-tree", Name: "Árvore AVL", EnglishName: "AVL Tree", Category: "Árvore", DotNetName: "custom AvlTree", Implementation: "árvore balanceada", SearchBig0: "O(log n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "heap", Name: "Heap (Min/Max)", EnglishName: "Heap", Category: "Árvore", DotNetName: "PriorityQueue<T>", Implementation: "heap binário", SearchBig0: "O(n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "hash-table", Name: "Tabela Hash", EnglishName: "Hash Table", Category: "Hash", DotNetName: "Dictionary<TKey,TValue>", Implementation: "hash buckets", SearchBig0: "O(1)", InsertBig0: "O(1)", UpdateBig0: "O(1)", Available: false},
	{ID: "graph", Name: "Grafo", EnglishName: "Graph", Category: "Grafo", DotNetName: "custom Graph", Implementation: "lista de adjacência", SearchBig0: "O(V+E)", InsertBig0: "O(1)", UpdateBig0: "O(1)", Available: false},
	{ID: "trie", Name: "Trie", EnglishName: "Trie", Category: "Árvore", DotNetName: "custom Trie", Implementation: "árvore de prefixos", SearchBig0: "O(m)", InsertBig0: "O(m)", UpdateBig0: "O(m)", Available: false},
}

var (
	templates       map[string]*template.Template
	devLiveReload   = os.Getenv("DS_DEV_LIVE_RELOAD") == "1"
	liveReloadState = newLiveReloadState()
)

func main() {
	var err error
	templates, err = loadTemplates()
	if err != nil {
		log.Fatalf("parsing templates: %v", err)
	}

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

	// API
	mux.HandleFunc("GET /api/structures", handleAPIStructures)
	mux.HandleFunc("GET /api/structure/{id}", handleAPIStructure)

	addr := serverAddr()
	log.Printf("ds-explorer listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
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

func loadTemplates() (map[string]*template.Template, error) {
	pages := []string{"home.html", "structure.html", "compare.html"}
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

func navGroups() []navGroup {
	groups := make([]navGroup, 0)
	indexByCategory := make(map[string]int)

	for _, item := range registry {
		idx, ok := indexByCategory[item.Category]
		if !ok {
			idx = len(groups)
			indexByCategory[item.Category] = idx
			groups = append(groups, navGroup{Category: item.Category})
		}
		groups[idx].Items = append(groups[idx].Items, item)
	}

	return groups
}

func getTemplate(page string) (*template.Template, error) {
	if devLiveReload {
		return parseTemplate(page)
	}
	tmpl, ok := templates[page]
	if !ok {
		return nil, fmt.Errorf("template %s not loaded", page)
	}
	return tmpl, nil
}

func renderPage(w http.ResponseWriter, page string, data any) {
	tmpl, err := getTemplate(page)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := tmpl.ExecuteTemplate(w, page, data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func assetURL(path string) string {
	if !devLiveReload {
		return path
	}
	return fmt.Sprintf("%s?v=%d", path, liveReloadState.Version())
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

	// Pass raw JSON as template.JS so the template can embed it safely.
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

type liveReloadTracker struct {
	version   atomic.Int64
	mu        sync.Mutex
	listeners map[chan int64]struct{}
}

func newLiveReloadState() *liveReloadTracker {
	t := &liveReloadTracker{
		listeners: make(map[chan int64]struct{}),
	}
	t.version.Store(time.Now().UnixMilli())
	return t
}

func (t *liveReloadTracker) Version() int64 {
	return t.version.Load()
}

func (t *liveReloadTracker) Subscribe() (chan int64, func()) {
	ch := make(chan int64, 1)

	t.mu.Lock()
	t.listeners[ch] = struct{}{}
	t.mu.Unlock()

	return ch, func() {
		t.mu.Lock()
		delete(t.listeners, ch)
		t.mu.Unlock()
		close(ch)
	}
}

func (t *liveReloadTracker) Notify() {
	version := time.Now().UnixMilli()
	t.version.Store(version)

	t.mu.Lock()
	defer t.mu.Unlock()

	for ch := range t.listeners {
		select {
		case ch <- version:
		default:
		}
	}
}

func watchLiveReloadChanges(roots []string, interval time.Duration) {
	state := make(map[string]time.Time)
	_, _ = scanLiveReloadFiles(roots, state)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		changed, err := scanLiveReloadFiles(roots, state)
		if err != nil {
			log.Printf("live reload watcher error: %v", err)
			continue
		}
		if changed {
			liveReloadState.Notify()
		}
	}
}

func scanLiveReloadFiles(roots []string, state map[string]time.Time) (bool, error) {
	seen := make(map[string]struct{})
	changed := false

	for _, root := range roots {
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				return nil
			}
			if !shouldWatchFile(path) {
				return nil
			}

			info, err := d.Info()
			if err != nil {
				return err
			}

			seen[path] = struct{}{}
			last, ok := state[path]
			if !ok || info.ModTime().After(last) {
				state[path] = info.ModTime()
				if ok {
					changed = true
				}
			}
			return nil
		})
		if err != nil {
			return false, err
		}
	}

	for path := range state {
		if _, ok := seen[path]; !ok {
			delete(state, path)
			changed = true
		}
	}

	return changed, nil
}

func shouldWatchFile(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg", ".ico", ".webp":
		return true
	default:
		return false
	}
}
