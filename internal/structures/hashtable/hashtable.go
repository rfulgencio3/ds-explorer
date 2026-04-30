// Package hashtable implementa uma tabela hash didatica com linear probing.
package hashtable

import "errors"

const tombstone = -1

// HashTable armazena chaves inteiras em buckets contiguos.
type HashTable struct {
	buckets []int
	used    []bool
	size    int
}

// New cria uma tabela com a capacidade informada.
func New(capacity int) *HashTable {
	return &HashTable{
		buckets: make([]int, capacity),
		used:    make([]bool, capacity),
	}
}

// Insert insere key usando linear probing.
// Complexidade media: O(1). Pior caso: O(n).
func (h *HashTable) Insert(key int) error {
	if h.size >= len(h.buckets) {
		return errors.New("tabela cheia")
	}
	for probe := 0; probe < len(h.buckets); probe++ {
		idx := h.index(key, probe)
		if !h.used[idx] || h.buckets[idx] == tombstone || h.buckets[idx] == key {
			if !h.used[idx] || h.buckets[idx] == tombstone {
				h.size++
			}
			h.buckets[idx] = key
			h.used[idx] = true
			return nil
		}
	}
	return errors.New("sem bucket livre")
}

// Search procura key seguindo a mesma sequencia de probing.
// Complexidade media: O(1). Pior caso: O(n).
func (h *HashTable) Search(key int) (int, bool) {
	for probe := 0; probe < len(h.buckets); probe++ {
		idx := h.index(key, probe)
		if !h.used[idx] {
			return -1, false
		}
		if h.buckets[idx] == key {
			return idx, true
		}
	}
	return -1, false
}

// Remove marca o bucket como tombstone para preservar a cadeia de busca.
// Complexidade media: O(1). Pior caso: O(n).
func (h *HashTable) Remove(key int) error {
	idx, ok := h.Search(key)
	if !ok {
		return errors.New("chave nao encontrada")
	}
	h.buckets[idx] = tombstone
	h.size--
	return nil
}

func (h *HashTable) index(key, probe int) int {
	if key < 0 {
		key = -key
	}
	return (key + probe) % len(h.buckets)
}

// Snapshot retorna copia dos buckets e marcadores de uso.
func (h *HashTable) Snapshot() ([]int, []bool) {
	b := make([]int, len(h.buckets))
	u := make([]bool, len(h.used))
	copy(b, h.buckets)
	copy(u, h.used)
	return b, u
}
