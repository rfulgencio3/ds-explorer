package main

import (
	"os"
	"path/filepath"
	"strings"
)

// Structure holds metadata for a data structure card and page.
type Structure struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	EnglishName     string `json:"englishName"`
	Category        string `json:"category"`
	Subtype         string `json:"subtype"`
	DotNetName      string `json:"dotNetName"`
	Implementation  string `json:"implementation"`
	Description     string `json:"description"`
	UseCases        string `json:"useCases"`
	Tradeoffs       string `json:"tradeoffs"`
	ReferenceURL    string `json:"referenceURL"`
	ReferenceSource string `json:"referenceSource"`
	SearchBig0      string `json:"searchBigO"` // summary for the card
	InsertBig0      string `json:"insertBigO"`
	UpdateBig0      string `json:"updateBigO"`
	Available       bool   `json:"available"`
}

type navGroup struct {
	Category string
	Items    []Structure
}

// registry lists every structure the application knows about.
// To add a new structure: append an entry here, create the JSON file and JS file.
var registry = []Structure{
	{ID: "array", Name: "Array Estático", EnglishName: "Static Array", Category: "Linear", Subtype: "Sequencial", DotNetName: "T[]", Implementation: "array contíguo fixo", Description: "Bloco contíguo de memória com acesso direto por índice.", UseCases: "Bom quando o tamanho é previsível e leitura por posição precisa ser rápida.", Tradeoffs: "Inserir ou remover no meio desloca elementos e custa mais.", ReferenceURL: "https://www.nist.gov/dads/HTML/array.html", ReferenceSource: "NIST DADS", SearchBig0: "O(n)", InsertBig0: "O(n)", UpdateBig0: "O(1)", Available: true},
	{ID: "dynamic-list", Name: "Lista Dinâmica", EnglishName: "Dynamic List", Category: "Linear", Subtype: "Sequencial", DotNetName: "List<T>", Implementation: "array dinâmico contíguo", Description: "Lista baseada em array dinâmico, com crescimento de capacidade sob demanda.", UseCases: "Boa quando o tamanho varia, mas acesso por índice e iteração sequencial continuam importantes.", Tradeoffs: "Inserções no meio ainda deslocam elementos e realocações ocasionais copiam o buffer inteiro.", ReferenceURL: "https://learn.microsoft.com/en-us/dotnet/fundamentals/runtime-libraries/system-collections-generic-list%7Bt%7D", ReferenceSource: "Microsoft Learn", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(1)", Available: true},
	{ID: "singly-linked-list", Name: "Lista Encadeada Simples", EnglishName: "Singly Linked List", Category: "Linear", Subtype: "Encadeada", DotNetName: "custom SinglyLinkedList", Implementation: "nós com next", Description: "Coleção linear formada por nós em que cada item aponta só para o próximo.", UseCases: "Útil quando inserções na cabeça são frequentes e a travessia sequencial basta.", Tradeoffs: "Não oferece acesso aleatório eficiente e a busca segue linear.", ReferenceURL: "https://www.nist.gov/dads/HTML/linkedList.html", ReferenceSource: "NIST DADS", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: true},
	{ID: "doubly-linked-list", Name: "Lista Encadeada Dupla", EnglishName: "Doubly Linked List", Category: "Linear", Subtype: "Encadeada", DotNetName: "LinkedList<T>", Implementation: "lista duplamente encadeada", Description: "Lista em que cada nó conhece o anterior e o próximo, permitindo travessia nos dois sentidos.", UseCases: "Boa para inserir e remover itens conhecidos sem precisar voltar a estrutura inteira.", Tradeoffs: "Cada nó consome mais memória e a localização por índice continua linear.", ReferenceURL: "https://www.nist.gov/dads/HTML/doublyLinkedList.html", ReferenceSource: "NIST DADS", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: true},
	{ID: "circular-list", Name: "Lista Circular", EnglishName: "Circular Linked List", Category: "Linear", Subtype: "Encadeada", DotNetName: "custom CircularList", Implementation: "lista encadeada circular", Description: "Variante encadeada em que o último nó volta ao início e a iteração pode recomecar sem reposicionar ponteiros.", UseCases: "Faz sentido em round-robin, buffers cíclicos e escalonamento.", Tradeoffs: "A parada da iteração exige mais cuidado para não criar loops infinitos.", ReferenceURL: "https://www.nist.gov/dads/HTML/circularlist.html", ReferenceSource: "NIST DADS", SearchBig0: "O(n)", InsertBig0: "O(n)", UpdateBig0: "O(n)", Available: true},
	// Future structures - set Available: false until implemented
	{ID: "stack", Name: "Pilha (Stack)", EnglishName: "Stack", Category: "Linear", Subtype: "Restrita", DotNetName: "Stack<T>", Implementation: "coleção LIFO", Description: "Estrutura em que o último item inserido é o primeiro a sair.", UseCases: "Adequada para undo, chamadas de função, parsing e backtracking.", Tradeoffs: "Acesso restrito ao topo; procurar itens internos não é o foco.", ReferenceURL: "https://www.nist.gov/dads/HTML/stack.html", ReferenceSource: "NIST DADS", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "queue", Name: "Fila (Queue)", EnglishName: "Queue", Category: "Linear", Subtype: "Restrita", DotNetName: "Queue<T>", Implementation: "coleção FIFO", Description: "Estrutura em que o primeiro item inserido é o primeiro a sair.", UseCases: "Boa para processamento em ordem de chegada, buffers e filas de trabalho.", Tradeoffs: "Acesso eficiente só nas extremidades; buscar no meio continua caro.", ReferenceURL: "https://www.nist.gov/dads/HTML/queue.html", ReferenceSource: "NIST DADS", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "circular-queue", Name: "Fila Circular", EnglishName: "Circular Queue", Category: "Linear", Subtype: "Restrita", DotNetName: "custom CircularQueue", Implementation: "buffer circular", Description: "Fila limitada implementada sobre um array em anel para reaproveitar espaço.", UseCases: "Faz sentido em buffers de IO, filas com capacidade fixa e sistemas embarcados.", Tradeoffs: "Exige controle cuidadoso de head, tail e estado cheio ou vazio.", ReferenceURL: "https://www.nist.gov/dads/HTML/circularQueue.html", ReferenceSource: "NIST DADS", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "deque", Name: "Deque", EnglishName: "Deque", Category: "Linear", Subtype: "Restrita", DotNetName: "custom Deque", Implementation: "duas extremidades", Description: "Fila de dupla extremidade, com inserção e remoção eficientes na frente e no fim.", UseCases: "Útil para janelas deslizantes, algoritmos monotonic queue e pilha ou fila flexível.", Tradeoffs: "A API cresce e a implementação precisa preservar bem as duas pontas.", ReferenceURL: "https://www.nist.gov/dads/HTML/deque.html", ReferenceSource: "NIST DADS", SearchBig0: "O(n)", InsertBig0: "O(1)", UpdateBig0: "O(n)", Available: false},
	{ID: "binary-search-tree", Name: "Árvore Binária de Busca", EnglishName: "Binary Search Tree", Category: "Árvore", DotNetName: "custom BinarySearchTree", Implementation: "árvore binária ordenada", Description: "Árvore binária em que a ordem dos valores permite navegar por comparação.", UseCases: "Boa para manter dados ordenados com consultas e inserções frequentes.", Tradeoffs: "Sem balanceamento, pode degradar para comportamento linear.", ReferenceURL: "https://www.nist.gov/dads/HTML/binarySearchTree.html", ReferenceSource: "NIST DADS", SearchBig0: "O(log n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "avl-tree", Name: "Árvore AVL", EnglishName: "AVL Tree", Category: "Árvore", DotNetName: "custom AvlTree", Implementation: "árvore balanceada", Description: "BST auto-balanceada que usa rotações para manter altura controlada.", UseCases: "Indicada quando a garantia de busca O(log n) é mais importante que simplicidade.", Tradeoffs: "Inserção e remoção são mais complexas por causa do rebalanceamento.", ReferenceURL: "https://www.nist.gov/dads/HTML/avltree.html", ReferenceSource: "NIST DADS", SearchBig0: "O(log n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "heap", Name: "Heap (Min/Max)", EnglishName: "Heap", Category: "Árvore", DotNetName: "PriorityQueue<T>", Implementation: "heap binário", Description: "Árvore quase completa usada para priorizar o menor ou maior elemento.", UseCases: "Ideal para filas de prioridade, escalonamento e seleção incremental.", Tradeoffs: "Ótimo para topo, mas não para busca arbitrária ordenada.", ReferenceURL: "https://www.nist.gov/dads/HTML/binaryheap.html", ReferenceSource: "NIST DADS", SearchBig0: "O(n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "hash-table", Name: "Tabela Hash", EnglishName: "Hash Table", Category: "Hash", DotNetName: "Dictionary<TKey,TValue>", Implementation: "hash buckets", Description: "Mapa de chaves para posições calculadas por função hash.", UseCases: "Excelente para lookup médio O(1), caches e dicionários por chave.", Tradeoffs: "Colisões e redimensionamento afetam memória e custo real.", ReferenceURL: "https://www.nist.gov/dads/HTML/hashtab.html", ReferenceSource: "NIST DADS", SearchBig0: "O(1)", InsertBig0: "O(1)", UpdateBig0: "O(1)", Available: false},
	{ID: "graph", Name: "Grafo", EnglishName: "Graph", Category: "Grafo", DotNetName: "custom Graph", Implementation: "lista de adjacência", Description: "Conjunto de vértices conectados por arestas, dirigido ou não.", UseCases: "Base para rotas, dependências, redes sociais e problemas de conectividade.", Tradeoffs: "A modelagem e os algoritmos ficam mais complexos que em estruturas lineares.", ReferenceURL: "https://www.nist.gov/dads/HTML/graph.html", ReferenceSource: "NIST DADS", SearchBig0: "O(V+E)", InsertBig0: "O(1)", UpdateBig0: "O(1)", Available: false},
	{ID: "skip-list", Name: "Skip List", EnglishName: "Skip List", Category: "Linear", Subtype: "Probabilística", DotNetName: "custom SkipList", Implementation: "listas encadeadas em níveis", Description: "Lista ordenada em múltiplos níveis com saltos probabilísticos para acelerar buscas e inserções.", UseCases: "Interessante quando se quer busca próxima de O(log n) com uma estrutura encadeada e balanceamento simples.", Tradeoffs: "Depende de aleatoriedade e usa mais ponteiros que uma lista ligada tradicional.", ReferenceURL: "https://www.nist.gov/dads/HTML/skiplist.html", ReferenceSource: "NIST DADS", SearchBig0: "O(log n)", InsertBig0: "O(log n)", UpdateBig0: "O(log n)", Available: false},
	{ID: "trie", Name: "Trie", EnglishName: "Trie", Category: "Árvore", DotNetName: "custom Trie", Implementation: "árvore de prefixos", Description: "Árvore especializada para armazenar chaves por prefixos compartilhados.", UseCases: "Muito útil para autocomplete, dicionários e busca por prefixo.", Tradeoffs: "Pode consumir bastante memória quando o alfabeto ou as chaves crescem.", ReferenceURL: "https://www.nist.gov/dads/HTML/trie.html", ReferenceSource: "NIST DADS", SearchBig0: "O(m)", InsertBig0: "O(m)", UpdateBig0: "O(m)", Available: false},
}

// navGroups groups the registry by Category, preserving insertion order.
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

// isKnownID reports whether id matches an entry in the registry.
func isKnownID(id string) bool {
	for _, s := range registry {
		if s.ID == id {
			return true
		}
	}
	return false
}

// loadStructureJSON reads content/structures/{id}.json from disk.
func loadStructureJSON(id string) ([]byte, error) {
	// Sanitise id to prevent path traversal.
	id = filepath.Base(strings.ReplaceAll(id, "..", ""))
	path := filepath.Join("content", "structures", id+".json")
	return os.ReadFile(path)
}
