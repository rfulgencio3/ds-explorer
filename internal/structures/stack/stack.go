// Package stack implementa uma pilha encadeada como referência didática.
// Este código serve de exemplo para aula e não é utilizado diretamente pelo servidor HTTP.
package stack

import "errors"

// node representa um nó da pilha.
// Cada nó guarda um valor e aponta para o próximo nó abaixo dele.
type node struct {
	Value int
	Next  *node
}

// Stack representa uma estrutura LIFO (Last In, First Out).
// Top aponta sempre para o elemento mais recente.
type Stack struct {
	Top  *node
	size int
}

// Push empilha um novo valor no topo da pilha em O(1).
// Basta criar um novo nó apontando para o topo anterior.
func (s *Stack) Push(value int) {
	s.Top = &node{
		Value: value,
		Next:  s.Top,
	}
	s.size++
}

// Pop remove e retorna o valor do topo em O(1).
// O topo passa a apontar para o próximo nó da pilha.
func (s *Stack) Pop() (int, error) {
	if s.Top == nil {
		return 0, errors.New("pilha vazia")
	}

	value := s.Top.Value
	s.Top = s.Top.Next
	s.size--
	return value, nil
}

// Peek retorna o valor do topo sem remover o nó em O(1).
func (s *Stack) Peek() (int, error) {
	if s.Top == nil {
		return 0, errors.New("pilha vazia")
	}
	return s.Top.Value, nil
}

// Search percorre a pilha do topo para a base em O(n).
// Retorna a profundidade do primeiro valor encontrado (0 = topo).
func (s *Stack) Search(value int) (int, bool) {
	current := s.Top
	for depth := 0; current != nil; depth++ {
		if current.Value == value {
			return depth, true
		}
		current = current.Next
	}
	return -1, false
}

// IsEmpty informa se a pilha está vazia em O(1).
func (s *Stack) IsEmpty() bool {
	return s.size == 0
}

// Size retorna a quantidade de elementos empilhados em O(1).
func (s *Stack) Size() int {
	return s.size
}

// ToSlice retorna uma cópia dos valores da pilha do topo para a base em O(n).
// É útil para depuração, visualização e material de apoio.
func (s *Stack) ToSlice() []int {
	result := make([]int, 0, s.size)
	for current := s.Top; current != nil; current = current.Next {
		result = append(result, current.Value)
	}
	return result
}
