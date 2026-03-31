/**
 * stack.js — Lógica de simulação da Pilha (Stack).
 *
 * Estado interno: array de objetos { id, value }
 * nodes[0] = topo (top) da pilha.
 * Operações: push, pop, peek, search.
 */

function initStructurePage() {
  let nodes  = [];
  let nextId = 0;
  const MAX_SIZE = 30;

  // ── Constantes de memória ──────────────────────────────────────────────
  // Nó de pilha encadeada (64-bit):
  //   value (int32):  4 bytes
  //   next (ptr64):   8 bytes
  //   padding:        4 bytes  → total = 16 bytes por nó
  // Alocação dinâmica: cada nó vai para um endereço aleatório no heap.
  const BYTES_PER_NODE = 16;
  const BASE_ADDR      = 0x4000;

  let _prevAccessedId = -1;

  // ── UI refs ────────────────────────────────────────────────────────────
  const meta        = window.__STRUCTURE_DATA__;
  const selectOp    = document.getElementById('select-operation');
  const inputSize   = document.getElementById('input-size');
  const btnGenerate = document.getElementById('btn-generate');
  const btnExecute  = document.getElementById('btn-execute');
  const fieldValue  = document.getElementById('field-value');
  const fieldIndex  = document.getElementById('field-index');
  const fieldNewVal = document.getElementById('field-new-value');
  const inputValue  = document.getElementById('input-value');

  // ── Substituir opções do select por operações de pilha ─────────────────
  selectOp.innerHTML = `
    <optgroup label="Pilha">
      <option value="push">Push (empilhar)</option>
      <option value="pop">Pop (desempilhar)</option>
      <option value="peek">Peek (ver topo)</option>
      <option value="search">Buscar por valor</option>
    </optgroup>
  `;

  const fieldMap = {
    push:   ['value'],
    pop:    [],
    peek:   [],
    search: ['value'],
  };

  function _syncFields() {
    StructureUI.syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, fieldMap);
  }
  selectOp.addEventListener('change', _syncFields);
  _syncFields();

  StructureUI.initMeta(meta, 'Pilha');

  MemoryPanel.init('stack');

  // ── Memory helpers ─────────────────────────────────────────────────────

  function _nodeAddr(id) {
    const offset  = ((id * 2654435761) >>> 0) % 0x4000;
    const aligned = offset & ~0xF;
    const hex = (BASE_ADDR + aligned).toString(16).toUpperCase();
    return '0x' + hex.padStart(4, '0');
  }

  function _cacheFor(nodeId) {
    const hit = nodeId === _prevAccessedId;
    _prevAccessedId = nodeId;
    if (hit) {
      return { event: 'hit',  cycles: 4,   note: 'Nó ainda presente no cache L1 — acesso recente' };
    }
    return {
      event:  'miss',
      cycles: 200,
      note:   `Ponteiro aponta para ${_nodeAddr(nodeId)} — endereço não contíguo, busca na RAM`,
    };
  }

  function _buildMemory(nodeList, accessedNodeId) {
    const totalBytes = nodeList.length * BYTES_PER_NODE;
    const cache = (accessedNodeId != null && accessedNodeId >= 0)
      ? _cacheFor(accessedNodeId)
      : { event: null, cycles: null, note: null };

    const layout = nodeList.map(n => ({ value: n.value, addr: _nodeAddr(n.id) }));

    const accessedIdx = (accessedNodeId != null)
      ? nodeList.findIndex(n => n.id === accessedNodeId)
      : null;

    return {
      type:        'stack',
      totalBytes,
      event:       cache.event,
      cycles:      cache.cycles,
      note:        cache.note,
      accessedIdx: accessedIdx >= 0 ? accessedIdx : null,
      layout,
    };
  }

  // ── Generate ─────────────────────────────────────────────────────────

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(MAX_SIZE, Math.max(2, parseInt(inputSize.value, 10) || 5));
    nodes = Array.from({ length: size }, () => ({ id: nextId++, value: Math.floor(Math.random() * 90) + 1 }));
    _prevAccessedId = -1;
    Animator.load([{
      description: `Pilha gerada com ${size} elementos. O topo (top) está à esquerda.`,
      snapshot: _snapshot(nodes, []),
      memory:   _buildMemory(nodes, null),
    }]);
  });
  btnGenerate.click();

  // ── Execute ────────────────────────────────────────────────────────────

  btnExecute.addEventListener('click', () => {
    if (nodes.length === 0 && selectOp.value !== 'push') {
      alert('A pilha está vazia. Use push para inserir um novo elemento.');
      return;
    }

    const op    = selectOp.value;
    const value = parseInt(inputValue.value, 10);
    let steps   = [];
    _prevAccessedId = -1;

    switch (op) {
      case 'push':   steps = _push(value); break;
      case 'pop':    steps = _pop(); break;
      case 'peek':   steps = _peek(); break;
      case 'search': steps = _search(value); break;
    }

    if (steps.length > 0) {
      const lastSnap = steps[steps.length - 1].snapshot;
      nodes = lastSnap.nodes.map(n => ({ id: n.id, value: n.value }));
    }

    Animator.load(steps);
  });

  // ── Operations ────────────────────────────────────────────────────────

  function _push(val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    if (nodes.length >= MAX_SIZE) {
      alert(`A pilha suporta no máximo ${MAX_SIZE} elementos.`);
      return [];
    }
    const list    = nodes.slice();
    const newNode = { id: nextId++, value: val };
    const steps   = [];

    steps.push({
      description: `Push ${val}: criando novo nó com valor ${val}.`,
      snapshot: _snapshot(list, [], 'neutral', [newNode], 'success'),
      memory:   _buildMemory([newNode, ...list], newNode.id),
    });

    steps.push({
      description: `Passo 2/3: Novo nó aponta para o antigo topo${list[0] ? ` (valor ${list[0].value})` : ' (null)'}.`,
      snapshot: _snapshot(list, list.length > 0 ? [0] : [], 'visiting', [newNode], 'success'),
      memory:   _buildMemory([newNode, ...list], list[0]?.id ?? null),
    });

    const result = [newNode, ...list];
    steps.push({
      description: `Passo 3/3: top atualizado para o novo nó ${val}. Push concluído — O(1).`,
      snapshot: _snapshot(result, [0], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _pop() {
    if (nodes.length === 0) { alert('Pilha vazia.'); return []; }
    const list    = nodes.slice();
    const removed = list[0];
    const steps   = [];

    steps.push({
      description: `Pop: removendo o topo da pilha (valor ${removed.value}).`,
      snapshot: _snapshot(list, [0], 'danger'),
      memory:   _buildMemory(list, removed.id),
    });

    const result = list.slice(1);
    steps.push({
      description: `Passo 2/2: top atualizado para ${result[0] ? `o próximo nó (valor ${result[0].value})` : 'null (pilha vazia)'}. Pop concluído — O(1).`,
      snapshot: _snapshot(result, result.length > 0 ? [0] : [], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _peek() {
    if (nodes.length === 0) { alert('Pilha vazia.'); return []; }
    const list  = nodes.slice();
    const steps = [];

    steps.push({
      description: `Peek: consultando o topo da pilha sem remover.`,
      snapshot: _snapshot(list, [0], 'visiting'),
      memory:   _buildMemory(list, list[0].id),
    });

    steps.push({
      description: `Passo 2/2: topo é ${list[0].value}. Pilha não foi modificada — O(1).`,
      snapshot: _snapshot(list, [0], 'success'),
      memory:   _buildMemory(list, list[0].id),
    });

    return steps;
  }

  function _search(val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const list  = nodes.slice();
    const steps = [];

    steps.push({
      description: `Busca pelo valor ${val}. Percorrendo a pilha a partir do topo...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < list.length; i++) {
      const found = list[i].value === val;
      steps.push({
        description: `Passo ${i + 1}/${list.length}: nó no nível ${i} tem valor ${list[i].value}. ${found ? 'ENCONTRADO!' : 'Diferente, descer via next.'}`,
        snapshot: _snapshot(list, [i], found ? 'success' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
      if (found) return steps;
    }

    steps.push({
      description: `Valor ${val} não encontrado na pilha.`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });
    return steps;
  }

  // ── Snapshot ───────────────────────────────────────────────────────────

  function _snapshot(list, highlightedIdxs = [], hlState = 'visiting', prependNodes = [], prependState = 'neutral') {
    const allNodes = [
      ...prependNodes.map(n => ({ id: n.id, value: n.value, state: prependState })),
      ...list.map((n, i) => ({
        id:    n.id,
        value: n.value,
        state: highlightedIdxs.includes(i) ? hlState : 'neutral',
      })),
    ];
    return { type: 'stack', nodes: allNodes, pointers: { top: allNodes[0]?.id } };
  }

}
