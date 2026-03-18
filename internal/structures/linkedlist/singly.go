// Package linkedlist implementa listas encadeadas como referência didática.
// Este código serve de exemplo para aula — não é utilizado diretamente pelo servidor HTTP.
package linkedlist

import "errors"

// nodeS é um nó da lista encadeada simples.
// Cada nó guarda um valor e um ponteiro para o próximo nó.
type nodeS struct {
	Value int
	Next  *nodeS
}

// SinglyLinkedList é uma lista encadeada com apenas ponteiro next.
// HEAD aponta para o primeiro nó; a lista termina quando Next == nil.
type SinglyLinkedList struct {
	Head *nodeS
	size int
}

// InsertBegin cria um novo nó e o coloca na frente da lista — O(1).
// O novo nó passa a ser o HEAD e aponta para o antigo primeiro nó.
func (l *SinglyLinkedList) InsertBegin(value int) {
	n := &nodeS{Value: value, Next: l.Head}
	l.Head = n
	l.size++
}

// InsertEnd percorre até o último nó e adiciona o novo nó lá — O(n).
// Se a lista estiver vazia, o novo nó se torna o HEAD.
func (l *SinglyLinkedList) InsertEnd(value int) {
	n := &nodeS{Value: value}
	if l.Head == nil {
		l.Head = n
		l.size++
		return
	}
	// Percorre até o último nó (aquele cujo Next é nil).
	current := l.Head
	for current.Next != nil {
		current = current.Next
	}
	current.Next = n
	l.size++
}

// InsertAt insere na posição index (0 = início) — O(n).
func (l *SinglyLinkedList) InsertAt(index, value int) error {
	if index < 0 || index > l.size {
		return errors.New("índice fora dos limites")
	}
	if index == 0 {
		l.InsertBegin(value)
		return nil
	}
	// Avança até o nó imediatamente anterior à posição desejada.
	current := l.Head
	for i := 0; i < index-1; i++ {
		current = current.Next
	}
	n := &nodeS{Value: value, Next: current.Next}
	current.Next = n
	l.size++
	return nil
}

// RemoveBegin remove e retorna o primeiro nó — O(1).
// HEAD passa a apontar para o segundo nó.
func (l *SinglyLinkedList) RemoveBegin() (int, error) {
	if l.Head == nil {
		return 0, errors.New("lista vazia")
	}
	value := l.Head.Value
	l.Head = l.Head.Next // HEAD avança um nó
	l.size--
	return value, nil
}

// RemoveEnd percorre até o penúltimo nó e desconecta o último — O(n).
func (l *SinglyLinkedList) RemoveEnd() (int, error) {
	if l.Head == nil {
		return 0, errors.New("lista vazia")
	}
	if l.Head.Next == nil {
		// Só há um nó: basta limpar o HEAD.
		value := l.Head.Value
		l.Head = nil
		l.size--
		return value, nil
	}
	// Percorre até o penúltimo nó.
	current := l.Head
	for current.Next.Next != nil {
		current = current.Next
	}
	value := current.Next.Value
	current.Next = nil // desconecta o último nó
	l.size--
	return value, nil
}

// RemoveAt remove o nó na posição index — O(n).
func (l *SinglyLinkedList) RemoveAt(index int) (int, error) {
	if index < 0 || index >= l.size {
		return 0, errors.New("índice fora dos limites")
	}
	if index == 0 {
		return l.RemoveBegin()
	}
	current := l.Head
	for i := 0; i < index-1; i++ {
		current = current.Next
	}
	value := current.Next.Value
	current.Next = current.Next.Next // "pula" o nó removido
	l.size--
	return value, nil
}

// RemoveByValue remove a primeira ocorrência do valor — O(n).
func (l *SinglyLinkedList) RemoveByValue(value int) error {
	if l.Head == nil {
		return errors.New("lista vazia")
	}
	if l.Head.Value == value {
		l.Head = l.Head.Next
		l.size--
		return nil
	}
	current := l.Head
	for current.Next != nil {
		if current.Next.Value == value {
			current.Next = current.Next.Next
			l.size--
			return nil
		}
		current = current.Next
	}
	return errors.New("valor não encontrado")
}

// Search retorna o índice da primeira ocorrência do valor — O(n).
func (l *SinglyLinkedList) Search(value int) (int, bool) {
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
func (l *SinglyLinkedList) Update(index, value int) error {
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
func (l *SinglyLinkedList) Size() int { return l.size }

// ToSlice retorna os valores em ordem (útil para depuração).
func (l *SinglyLinkedList) ToSlice() []int {
	result := make([]int, 0, l.size)
	current := l.Head
	for current != nil {
		result = append(result, current.Value)
		current = current.Next
	}
	return result
}
