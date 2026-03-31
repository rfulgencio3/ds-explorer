// Package queue implementa uma fila encadeada como referência didática.
// Este código serve de exemplo para aula e não é utilizado diretamente pelo servidor HTTP.
package queue

import "errors"

// node representa um nó da fila.
// Cada nó guarda um valor e aponta para o próximo elemento da fila.
type node struct {
	Value int
	Next  *node
}

// Queue representa uma estrutura FIFO (First In, First Out).
// Front aponta para o primeiro elemento e Rear para o último.
type Queue struct {
	Front *node
	Rear  *node
	size  int
}

// Enqueue insere um valor no final da fila em O(1).
// Rear permite anexar o novo nó sem percorrer a estrutura inteira.
func (q *Queue) Enqueue(value int) {
	n := &node{Value: value}

	if q.Rear == nil {
		q.Front = n
		q.Rear = n
		q.size++
		return
	}

	q.Rear.Next = n
	q.Rear = n
	q.size++
}

// Dequeue remove e retorna o valor da frente da fila em O(1).
// Front passa a apontar para o próximo nó.
func (q *Queue) Dequeue() (int, error) {
	if q.Front == nil {
		return 0, errors.New("fila vazia")
	}

	value := q.Front.Value
	q.Front = q.Front.Next
	if q.Front == nil {
		q.Rear = nil
	}
	q.size--
	return value, nil
}

// Peek retorna o valor na frente da fila sem removê-lo em O(1).
func (q *Queue) Peek() (int, error) {
	if q.Front == nil {
		return 0, errors.New("fila vazia")
	}
	return q.Front.Value, nil
}

// Search percorre a fila da frente para trás em O(n).
// Retorna a posição do primeiro valor encontrado (0 = frente).
func (q *Queue) Search(value int) (int, bool) {
	current := q.Front
	for index := 0; current != nil; index++ {
		if current.Value == value {
			return index, true
		}
		current = current.Next
	}
	return -1, false
}

// IsEmpty informa se a fila está vazia em O(1).
func (q *Queue) IsEmpty() bool {
	return q.size == 0
}

// Size retorna a quantidade de elementos na fila em O(1).
func (q *Queue) Size() int {
	return q.size
}

// ToSlice retorna uma cópia dos valores da fila da frente para trás em O(n).
// É útil para depuração, visualização e material de apoio.
func (q *Queue) ToSlice() []int {
	result := make([]int, 0, q.size)
	for current := q.Front; current != nil; current = current.Next {
		result = append(result, current.Value)
	}
	return result
}
