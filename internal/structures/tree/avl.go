package tree

// AVLNode guarda altura para calcular balanceamento.
type AVLNode struct {
	Value  int
	Height int
	Left   *AVLNode
	Right  *AVLNode
}

// AVLTree e uma BST auto-balanceada por rotacoes.
type AVLTree struct {
	Root *AVLNode
}

// Insert adiciona value e rebalanceia a arvore.
// Complexidade: O(log n).
func (t *AVLTree) Insert(value int) {
	t.Root = insertAVL(t.Root, value)
}

// Search procura value seguindo a propriedade de BST.
// Complexidade: O(log n), pois a altura e mantida balanceada.
func (t *AVLTree) Search(value int) bool {
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

func insertAVL(node *AVLNode, value int) *AVLNode {
	if node == nil {
		return &AVLNode{Value: value, Height: 1}
	}
	if value < node.Value {
		node.Left = insertAVL(node.Left, value)
	} else if value > node.Value {
		node.Right = insertAVL(node.Right, value)
	} else {
		return node
	}

	updateHeight(node)
	return rebalance(node)
}

func rebalance(node *AVLNode) *AVLNode {
	b := avlBalance(node)
	if b > 1 {
		if avlBalance(node.Left) < 0 {
			node.Left = rotateLeft(node.Left)
		}
		return rotateRight(node)
	}
	if b < -1 {
		if avlBalance(node.Right) > 0 {
			node.Right = rotateRight(node.Right)
		}
		return rotateLeft(node)
	}
	return node
}

func rotateRight(y *AVLNode) *AVLNode {
	x := y.Left
	t2 := x.Right
	x.Right = y
	y.Left = t2
	updateHeight(y)
	updateHeight(x)
	return x
}

func rotateLeft(x *AVLNode) *AVLNode {
	y := x.Right
	t2 := y.Left
	y.Left = x
	x.Right = t2
	updateHeight(x)
	updateHeight(y)
	return y
}

func updateHeight(node *AVLNode) {
	left := avlHeight(node.Left)
	right := avlHeight(node.Right)
	if left > right {
		node.Height = left + 1
	} else {
		node.Height = right + 1
	}
}

func avlHeight(node *AVLNode) int {
	if node == nil {
		return 0
	}
	return node.Height
}

func avlBalance(node *AVLNode) int {
	if node == nil {
		return 0
	}
	return avlHeight(node.Left) - avlHeight(node.Right)
}
