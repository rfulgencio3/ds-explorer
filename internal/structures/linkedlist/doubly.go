package linkedlist

import "errors"

// nodeD é um nó da lista duplamente encadeada.
// Cada nó possui ponteiros para o próximo (Next) E para o anterior (Prev).
type nodeD struct {
	Value int
	Next  *nodeD
	Prev  *nodeD
}

// DoublyLinkedList possui HEAD (início) e TAIL (fim), permitindo
// percorrer a lista nos dois sentidos e inserção/remoção no fim em O(1).
type DoublyLinkedList struct {
	Head *nodeD
	Tail *nodeD
	size int
}

// InsertBegin insere no início — O(1).
// O novo nó se torna HEAD; seu Next aponta para o antigo HEAD;
// o antigo HEAD passa a ter Prev apontando para o novo nó.
func (l *DoublyLinkedList) InsertBegin(value int) {
	n := &nodeD{Value: value}
	if l.Head == nil {
		l.Head = n
		l.Tail = n
	} else {
		n.Next = l.Head   // novo nó aponta para o antigo HEAD
		l.Head.Prev = n   // antigo HEAD passa a ter predecessor
		l.Head = n        // HEAD atualizado
	}
	l.size++
}

// InsertEnd insere no final usando TAIL — O(1) (vantagem sobre a lista simples).
func (l *DoublyLinkedList) InsertEnd(value int) {
	n := &nodeD{Value: value}
	if l.Tail == nil {
		l.Head = n
		l.Tail = n
	} else {
		n.Prev = l.Tail   // novo nó aponta para o antigo TAIL
		l.Tail.Next = n   // antigo TAIL aponta para o novo nó
		l.Tail = n        // TAIL atualizado
	}
	l.size++
}

// InsertAt insere na posição index — O(n).
func (l *DoublyLinkedList) InsertAt(index, value int) error {
	if index < 0 || index > l.size {
		return errors.New("índice fora dos limites")
	}
	if index == 0 {
		l.InsertBegin(value)
		return nil
	}
	if index == l.size {
		l.InsertEnd(value)
		return nil
	}

	// Avança até o nó que atualmente ocupa a posição index.
	current := l.Head
	for i := 0; i < index; i++ {
		current = current.Next
	}

	n := &nodeD{Value: value}
	prev := current.Prev

	// Liga o novo nó entre prev e current.
	n.Prev = prev
	n.Next = current
	prev.Next = n
	current.Prev = n

	l.size++
	return nil
}

// RemoveBegin remove o primeiro nó — O(1).
func (l *DoublyLinkedList) RemoveBegin() (int, error) {
	if l.Head == nil {
		return 0, errors.New("lista vazia")
	}
	value := l.Head.Value
	l.Head = l.Head.Next
	if l.Head != nil {
		l.Head.Prev = nil // novo HEAD não tem predecessor
	} else {
		l.Tail = nil // lista ficou vazia
	}
	l.size--
	return value, nil
}

// RemoveEnd remove o último nó usando TAIL — O(1).
func (l *DoublyLinkedList) RemoveEnd() (int, error) {
	if l.Tail == nil {
		return 0, errors.New("lista vazia")
	}
	value := l.Tail.Value
	l.Tail = l.Tail.Prev
	if l.Tail != nil {
		l.Tail.Next = nil // novo TAIL não tem sucessor
	} else {
		l.Head = nil // lista ficou vazia
	}
	l.size--
	return value, nil
}

// RemoveAt remove o nó na posição index — O(n).
func (l *DoublyLinkedList) RemoveAt(index int) (int, error) {
	if index < 0 || index >= l.size {
		return 0, errors.New("índice fora dos limites")
	}
	if index == 0 {
		return l.RemoveBegin()
	}
	if index == l.size-1 {
		return l.RemoveEnd()
	}

	current := l.Head
	for i := 0; i < index; i++ {
		current = current.Next
	}

	// Reconecta os vizinhos, "pulando" o nó atual.
	current.Prev.Next = current.Next
	current.Next.Prev = current.Prev

	l.size--
	return current.Value, nil
}

// RemoveByValue remove a primeira ocorrência do valor — O(n).
func (l *DoublyLinkedList) RemoveByValue(value int) error {
	current := l.Head
	for current != nil {
		if current.Value == value {
			if current.Prev != nil {
				current.Prev.Next = current.Next
			} else {
				l.Head = current.Next
			}
			if current.Next != nil {
				current.Next.Prev = current.Prev
			} else {
				l.Tail = current.Prev
			}
			l.size--
			return nil
		}
		current = current.Next
	}
	return errors.New("valor não encontrado")
}

// Search retorna o índice da primeira ocorrência — O(n).
func (l *DoublyLinkedList) Search(value int) (int, bool) {
	current := l.Head
	for i := 0; current != nil; i++ {
		if current.Value == value {
			return i, true
		}
		current = current.Next
	}
	return -1, false
}

// Update substitui o valor do nó na posição index — O(n).
func (l *DoublyLinkedList) Update(index, value int) error {
	if index < 0 || index >= l.size {
		return errors.New("índice fora dos limites")
	}
	current := l.Head
	for i := 0; i < index; i++ {
		current = current.Next
	}
	current.Value = value
	return nil
}

// Size retorna o número de nós.
func (l *DoublyLinkedList) Size() int { return l.size }

// ToSlice retorna os valores em ordem.
func (l *DoublyLinkedList) ToSlice() []int {
	result := make([]int, 0, l.size)
	current := l.Head
	for current != nil {
		result = append(result, current.Value)
		current = current.Next
	}
	return result
}
