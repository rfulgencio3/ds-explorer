// Package deque implementa um deque duplamente encadeado como referência didática.
// Este código serve de exemplo para aula e não é utilizado diretamente pelo servidor HTTP.
package deque

import "errors"

// node representa um nó do deque.
// Cada nó aponta para o próximo e para o anterior.
type node struct {
	Value int
	Next  *node
	Prev  *node
}

// Deque representa uma fila de dupla extremidade.
// Front aponta para a frente e Rear para o fim.
type Deque struct {
	Front *node
	Rear  *node
	size  int
}

// PushFront insere um valor na frente em O(1).
func (d *Deque) PushFront(value int) {
	n := &node{Value: value, Next: d.Front}
	if d.Front != nil {
		d.Front.Prev = n
	} else {
		d.Rear = n
	}
	d.Front = n
	d.size++
}

// PushBack insere um valor no fim em O(1).
func (d *Deque) PushBack(value int) {
	n := &node{Value: value, Prev: d.Rear}
	if d.Rear != nil {
		d.Rear.Next = n
	} else {
		d.Front = n
	}
	d.Rear = n
	d.size++
}

// PopFront remove e retorna o valor da frente em O(1).
func (d *Deque) PopFront() (int, error) {
	if d.Front == nil {
		return 0, errors.New("deque vazio")
	}

	value := d.Front.Value
	d.Front = d.Front.Next
	if d.Front != nil {
		d.Front.Prev = nil
	} else {
		d.Rear = nil
	}
	d.size--
	return value, nil
}

// PopBack remove e retorna o valor do fim em O(1).
func (d *Deque) PopBack() (int, error) {
	if d.Rear == nil {
		return 0, errors.New("deque vazio")
	}

	value := d.Rear.Value
	d.Rear = d.Rear.Prev
	if d.Rear != nil {
		d.Rear.Next = nil
	} else {
		d.Front = nil
	}
	d.size--
	return value, nil
}

// PeekFront retorna o valor da frente sem removê-lo.
func (d *Deque) PeekFront() (int, error) {
	if d.Front == nil {
		return 0, errors.New("deque vazio")
	}
	return d.Front.Value, nil
}

// PeekBack retorna o valor do fim sem removê-lo.
func (d *Deque) PeekBack() (int, error) {
	if d.Rear == nil {
		return 0, errors.New("deque vazio")
	}
	return d.Rear.Value, nil
}

// Search percorre o deque da frente para o fim em O(n).
// Retorna a posição do primeiro valor encontrado.
func (d *Deque) Search(value int) (int, bool) {
	current := d.Front
	for index := 0; current != nil; index++ {
		if current.Value == value {
			return index, true
		}
		current = current.Next
	}
	return -1, false
}

// IsEmpty informa se o deque está vazio.
func (d *Deque) IsEmpty() bool {
	return d.size == 0
}

// Size retorna a quantidade de elementos armazenados.
func (d *Deque) Size() int {
	return d.size
}

// ToSlice retorna os valores do front para o rear.
func (d *Deque) ToSlice() []int {
	result := make([]int, 0, d.size)
	for current := d.Front; current != nil; current = current.Next {
		result = append(result, current.Value)
	}
	return result
}
