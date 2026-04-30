// Package tree contem arvores didaticas usadas como referencia de estudo.
package tree

import "errors"

// BSTNode representa um no de arvore binaria de busca.
type BSTNode struct {
	Value int
	Left  *BSTNode
	Right *BSTNode
}

// BinarySearchTree mantem valores menores a esquerda e maiores a direita.
type BinarySearchTree struct {
	Root *BSTNode
}

// Insert adiciona value seguindo comparacoes binariais.
// Complexidade media: O(log n). Pior caso: O(n).
func (t *BinarySearchTree) Insert(value int) {
	t.Root = insertBST(t.Root, value)
}

func insertBST(node *BSTNode, value int) *BSTNode {
	if node == nil {
		return &BSTNode{Value: value}
	}
	if value < node.Value {
		node.Left = insertBST(node.Left, value)
	} else if value > node.Value {
		node.Right = insertBST(node.Right, value)
	}
	return node
}

// Search informa se value esta na arvore.
// Complexidade media: O(log n). Pior caso: O(n).
func (t *BinarySearchTree) Search(value int) bool {
	current := t.Root
	for current != nil {
		if value == current.Value {
			return true
		}
		if value < current.Value {
			current = current.Left
		} else {
			current = current.Right
		}
	}
	return false
}

// Remove exclui value preservando a propriedade da BST.
// Complexidade media: O(log n). Pior caso: O(n).
func (t *BinarySearchTree) Remove(value int) error {
	var removed bool
	t.Root, removed = removeBST(t.Root, value)
	if !removed {
		return errors.New("valor nao encontrado")
	}
	return nil
}

func removeBST(node *BSTNode, value int) (*BSTNode, bool) {
	if node == nil {
		return nil, false
	}
	if value < node.Value {
		var removed bool
		node.Left, removed = removeBST(node.Left, value)
		return node, removed
	}
	if value > node.Value {
		var removed bool
		node.Right, removed = removeBST(node.Right, value)
		return node, removed
	}
	if node.Left == nil {
		return node.Right, true
	}
	if node.Right == nil {
		return node.Left, true
	}
	successor := minBST(node.Right)
	node.Value = successor.Value
	node.Right, _ = removeBST(node.Right, successor.Value)
	return node, true
}

func minBST(node *BSTNode) *BSTNode {
	for node.Left != nil {
		node = node.Left
	}
	return node
}

// InOrder retorna os valores em ordem crescente.
func (t *BinarySearchTree) InOrder() []int {
	out := []int{}
	var walk func(*BSTNode)
	walk = func(node *BSTNode) {
		if node == nil {
			return
		}
		walk(node.Left)
		out = append(out, node.Value)
		walk(node.Right)
	}
	walk(t.Root)
	return out
}
