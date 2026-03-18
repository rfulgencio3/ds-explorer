// Package array implementa um array estático de tamanho fixo como referência didática.
// Este código serve de exemplo para aula — não é utilizado diretamente pelo servidor HTTP.
package array

import "errors"

// StaticArray representa um array de tamanho fixo.
// Uma vez criado, seu capacity não muda (diferente de slices Go).
type StaticArray struct {
	data     []int
	size     int // quantidade de elementos atualmente armazenados
	capacity int // tamanho máximo definido na criação
}

// New cria um StaticArray com a capacidade fornecida.
func New(capacity int) *StaticArray {
	return &StaticArray{
		data:     make([]int, capacity),
		size:     0,
		capacity: capacity,
	}
}

// Access retorna o elemento na posição index em O(1).
// Acesso direto por índice é a grande vantagem do array.
func (a *StaticArray) Access(index int) (int, error) {
	if index < 0 || index >= a.size {
		return 0, errors.New("índice fora dos limites")
	}
	return a.data[index], nil
}

// Search faz busca linear pelo valor e retorna o primeiro índice encontrado.
// Complexidade: O(n) — precisa percorrer até achar ou chegar ao fim.
func (a *StaticArray) Search(value int) (int, bool) {
	for i := 0; i < a.size; i++ {
		if a.data[i] == value {
			return i, true
		}
	}
	return -1, false
}

// InsertAt insere value na posição index deslocando os elementos à direita.
// O shift é o custo extra do array: O(n) no pior caso (inserção no início).
func (a *StaticArray) InsertAt(index, value int) error {
	if a.size >= a.capacity {
		return errors.New("array cheio")
	}
	if index < 0 || index > a.size {
		return errors.New("índice fora dos limites")
	}

	// Desloca cada elemento uma posição para a direita, do fim até index.
	// Isso abre espaço para o novo valor.
	for i := a.size; i > index; i-- {
		a.data[i] = a.data[i-1]
	}

	a.data[index] = value
	a.size++
	return nil
}

// InsertBegin insere no início — custo máximo de shift.
func (a *StaticArray) InsertBegin(value int) error {
	return a.InsertAt(0, value)
}

// InsertEnd insere no final — sem shift necessário, O(1).
func (a *StaticArray) InsertEnd(value int) error {
	return a.InsertAt(a.size, value)
}

// RemoveAt remove o elemento em index e desloca os posteriores à esquerda.
// Complexidade: O(n) — o shift inverso é necessário para manter a continuidade.
func (a *StaticArray) RemoveAt(index int) (int, error) {
	if index < 0 || index >= a.size {
		return 0, errors.New("índice fora dos limites")
	}

	removed := a.data[index]

	// Desloca elementos à esquerda para preencher o buraco deixado pela remoção.
	for i := index; i < a.size-1; i++ {
		a.data[i] = a.data[i+1]
	}

	a.size--
	return removed, nil
}

// RemoveBegin remove o primeiro elemento — custo máximo de shift.
func (a *StaticArray) RemoveBegin() (int, error) {
	return a.RemoveAt(0)
}

// RemoveEnd remove o último elemento — sem shift, O(1).
func (a *StaticArray) RemoveEnd() (int, error) {
	return a.RemoveAt(a.size - 1)
}

// Update substitui o valor no índice informado.
// Acesso direto: O(1).
func (a *StaticArray) Update(index, value int) error {
	if index < 0 || index >= a.size {
		return errors.New("índice fora dos limites")
	}
	a.data[index] = value
	return nil
}

// Size retorna a quantidade de elementos armazenados.
func (a *StaticArray) Size() int { return a.size }

// Capacity retorna o tamanho máximo do array.
func (a *StaticArray) Capacity() int { return a.capacity }

// Snapshot retorna uma cópia dos elementos atuais (útil para depuração/testes).
func (a *StaticArray) Snapshot() []int {
	cp := make([]int, a.size)
	copy(cp, a.data[:a.size])
	return cp
}
