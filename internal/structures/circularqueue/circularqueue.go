// Package circularqueue implementa uma fila circular em array como referência didática.
// Este código serve de exemplo para aula e não é utilizado diretamente pelo servidor HTTP.
package circularqueue

import "errors"

// CircularQueue representa uma fila FIFO com capacidade fixa.
// Head aponta para o próximo elemento a sair; Tail para a próxima escrita.
type CircularQueue struct {
	data []int
	head int
	tail int
	size int
}

// New cria uma fila circular com capacidade fixa.
func New(capacity int) (*CircularQueue, error) {
	if capacity <= 0 {
		return nil, errors.New("capacidade invalida")
	}
	return &CircularQueue{data: make([]int, capacity)}, nil
}

// Enqueue insere um valor em O(1) no slot Tail.
// Quando Tail chega ao fim do array, ele volta ao início com módulo.
func (q *CircularQueue) Enqueue(value int) error {
	if q.IsFull() {
		return errors.New("fila cheia")
	}

	q.data[q.tail] = value
	q.tail = (q.tail + 1) % len(q.data)
	q.size++
	return nil
}

// Dequeue remove e retorna o valor mais antigo em O(1).
// Head avança circularmente para o próximo slot lógico.
func (q *CircularQueue) Dequeue() (int, error) {
	if q.IsEmpty() {
		return 0, errors.New("fila vazia")
	}

	value := q.data[q.head]
	q.head = (q.head + 1) % len(q.data)
	q.size--
	return value, nil
}

// Peek retorna o valor da frente sem removê-lo em O(1).
func (q *CircularQueue) Peek() (int, error) {
	if q.IsEmpty() {
		return 0, errors.New("fila vazia")
	}
	return q.data[q.head], nil
}

// Search percorre a fila da frente para trás em O(n).
// Retorna a posição lógica do primeiro valor encontrado.
func (q *CircularQueue) Search(value int) (int, bool) {
	for i := 0; i < q.size; i++ {
		idx := (q.head + i) % len(q.data)
		if q.data[idx] == value {
			return i, true
		}
	}
	return -1, false
}

// IsEmpty informa se a fila não contém elementos.
func (q *CircularQueue) IsEmpty() bool {
	return q.size == 0
}

// IsFull informa se todos os slots do buffer estão ocupados.
func (q *CircularQueue) IsFull() bool {
	return q.size == len(q.data)
}

// Size retorna a quantidade atual de elementos.
func (q *CircularQueue) Size() int {
	return q.size
}

// Capacity retorna o total de slots disponíveis no buffer.
func (q *CircularQueue) Capacity() int {
	return len(q.data)
}

// ToSlice materializa os elementos na ordem lógica da fila.
func (q *CircularQueue) ToSlice() []int {
	result := make([]int, 0, q.size)
	for i := 0; i < q.size; i++ {
		idx := (q.head + i) % len(q.data)
		result = append(result, q.data[idx])
	}
	return result
}
