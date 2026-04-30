// Package heap implementa um Min Heap didatico baseado em slice.
package heap

import "errors"

// MinHeap mantem o menor valor na raiz.
type MinHeap struct {
	data []int
}

// New cria um heap vazio.
func New() *MinHeap {
	return &MinHeap{data: []int{}}
}

// Insert adiciona value e executa heapify up.
// Complexidade: O(log n).
func (h *MinHeap) Insert(value int) {
	h.data = append(h.data, value)
	i := len(h.data) - 1
	for i > 0 {
		parent := (i - 1) / 2
		if h.data[parent] <= h.data[i] {
			break
		}
		h.data[parent], h.data[i] = h.data[i], h.data[parent]
		i = parent
	}
}

// Peek retorna o menor valor sem remover.
// Complexidade: O(1).
func (h *MinHeap) Peek() (int, error) {
	if len(h.data) == 0 {
		return 0, errors.New("heap vazio")
	}
	return h.data[0], nil
}

// ExtractMin remove e retorna o menor valor.
// Complexidade: O(log n).
func (h *MinHeap) ExtractMin() (int, error) {
	if len(h.data) == 0 {
		return 0, errors.New("heap vazio")
	}
	min := h.data[0]
	last := h.data[len(h.data)-1]
	h.data = h.data[:len(h.data)-1]
	if len(h.data) > 0 {
		h.data[0] = last
		h.heapifyDown(0)
	}
	return min, nil
}

// Search procura value percorrendo o array interno.
// Complexidade: O(n), pois heap nao ordena busca arbitraria.
func (h *MinHeap) Search(value int) (int, bool) {
	for i, item := range h.data {
		if item == value {
			return i, true
		}
	}
	return -1, false
}

func (h *MinHeap) heapifyDown(i int) {
	for {
		left := i*2 + 1
		right := i*2 + 2
		smallest := i
		if left < len(h.data) && h.data[left] < h.data[smallest] {
			smallest = left
		}
		if right < len(h.data) && h.data[right] < h.data[smallest] {
			smallest = right
		}
		if smallest == i {
			return
		}
		h.data[i], h.data[smallest] = h.data[smallest], h.data[i]
		i = smallest
	}
}

// Snapshot retorna copia do array interno.
func (h *MinHeap) Snapshot() []int {
	cp := make([]int, len(h.data))
	copy(cp, h.data)
	return cp
}
