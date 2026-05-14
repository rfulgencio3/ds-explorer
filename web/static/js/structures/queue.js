/**
 * queue.js — Lógica de simulação da Fila (Queue).
 *
 * Estado interno: array de objetos { id, value }
 * nodes[0] = frente (front), nodes[last] = traseira (rear).
 * Operações: enqueue (inserir no rear), dequeue (remover do front), peek, search.
 * Com ponteiros front e rear, enqueue e dequeue são O(1).
 */

function initStructurePage() {
  let nodes  = [];
  let nextId = 0;
  const MAX_SIZE = 30;

  // ── UI ────────────────────────────────────────────────────────────────
  const { btnGenerate, btnExecute, inputSize, inputValue } = StructureUI.bootstrap({
    fallbackName: 'Fila',
    memoryType:   'queue',
    fieldMap:     { enqueue: ['value'], dequeue: [], peek: [], search: ['value'] },
    selectHtml: `
      <optgroup label="Fila">
        <option value="enqueue">Enqueue (inserir no rear)</option>
        <option value="dequeue">Dequeue (remover do front)</option>
        <option value="peek">Peek (ver frente)</option>
        <option value="search">Buscar por valor</option>
      </optgroup>
    `,
  });

  // ── Memory ────────────────────────────────────────────────────────────
  const _mem = MemoryHelpers.forLinked({
    type: 'queue', bytesPerNode: 16, baseAddr: 0x5000,
    hashMult: 2654435761, rangeSize: 0x4000, alignMask: ~0xF,
  });

  function _buildMemory(nodeList, accessedNodeId) { return _mem.buildMemory(nodeList, accessedNodeId); }

  // ── Generate ─────────────────────────────────────────────────────────

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(MAX_SIZE, Math.max(2, parseInt(inputSize.value, 10) || 5));
    nodes = Array.from({ length: size }, () => ({ id: nextId++, value: Math.floor(Math.random() * 90) + 1 }));
    _mem.reset();
    Animator.load([{
      description: `Fila gerada com ${size} elementos. front (frente) à esquerda → rear (traseira) à direita.`,
      snapshot: _snapshot(nodes, []),
      memory:   _buildMemory(nodes, null),
    }]);
  });
  btnGenerate.click();

  // ── Execute ────────────────────────────────────────────────────────────

  btnExecute.addEventListener('click', () => {
    if (nodes.length === 0 && selectOp.value !== 'enqueue') {
      alert('A fila está vazia. Use enqueue para inserir um novo elemento.');
      return;
    }

    const op    = selectOp.value;
    const value = parseInt(inputValue.value, 10);
    let steps   = [];
    _mem.reset();

    switch (op) {
      case 'enqueue': steps = _enqueue(value); break;
      case 'dequeue': steps = _dequeue(); break;
      case 'peek':    steps = _peek(); break;
      case 'search':  steps = _search(value); break;
    }

    if (steps.length > 0) {
      const lastSnap = steps[steps.length - 1].snapshot;
      nodes = lastSnap.nodes.map(n => ({ id: n.id, value: n.value }));
    }

    Animator.load(steps);
  });

  // ── Operations ────────────────────────────────────────────────────────

  function _enqueue(val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    if (nodes.length >= MAX_SIZE) {
      alert(`A fila suporta no máximo ${MAX_SIZE} elementos.`);
      return [];
    }
    const list    = nodes.slice();
    const newNode = { id: nextId++, value: val };
    const steps   = [];

    steps.push({
      description: `Enqueue ${val}: criando novo nó com valor ${val} para inserir no rear.`,
      snapshot: _snapshot(list, [], 'neutral', [], 'neutral', [newNode], 'success'),
      memory:   _buildMemory([...list, newNode], newNode.id),
    });

    steps.push({
      description: `Passo 2/3: rear acessa diretamente o último nó${list.length > 0 ? ` (valor ${list[list.length - 1].value})` : ''} via ponteiro — O(1).`,
      snapshot: _snapshot(list, list.length > 0 ? [list.length - 1] : [], 'visiting', [], 'neutral', [newNode], 'success'),
      memory:   _buildMemory([...list, newNode], list.length > 0 ? list[list.length - 1].id : newNode.id),
    });

    const result = [...list, newNode];
    steps.push({
      description: `Passo 3/3: rear atualizado para o novo nó ${val}. Enqueue concluído — O(1).`,
      snapshot: _snapshot(result, [result.length - 1], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _dequeue() {
    if (nodes.length === 0) { alert('Fila vazia.'); return []; }
    const list    = nodes.slice();
    const removed = list[0];
    const steps   = [];

    steps.push({
      description: `Dequeue: removendo o elemento da frente da fila (valor ${removed.value}).`,
      snapshot: _snapshot(list, [0], 'danger'),
      memory:   _buildMemory(list, removed.id),
    });

    const result = list.slice(1);
    steps.push({
      description: `Passo 2/2: front atualizado para ${result[0] ? `o próximo nó (valor ${result[0].value})` : 'null (fila vazia)'}. Dequeue concluído — O(1).`,
      snapshot: _snapshot(result, result.length > 0 ? [0] : [], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _peek() {
    if (nodes.length === 0) { alert('Fila vazia.'); return []; }
    const list  = nodes.slice();
    const steps = [];

    steps.push({
      description: `Peek: consultando o front da fila sem remover.`,
      snapshot: _snapshot(list, [0], 'visiting'),
      memory:   _buildMemory(list, list[0].id),
    });

    steps.push({
      description: `Passo 2/2: front é ${list[0].value}. Fila não foi modificada — O(1).`,
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
      description: `Busca pelo valor ${val}. Percorrendo a fila a partir do front...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < list.length; i++) {
      const found = list[i].value === val;
      steps.push({
        description: `Passo ${i + 1}/${list.length}: nó na posição ${i} tem valor ${list[i].value}. ${found ? 'ENCONTRADO!' : 'Diferente, avançar via next.'}`,
        snapshot: _snapshot(list, [i], found ? 'success' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
      if (found) return steps;
    }

    steps.push({
      description: `Valor ${val} não encontrado na fila.`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });
    return steps;
  }

  // ── Snapshot ───────────────────────────────────────────────────────────

  function _snapshot(list, highlightedIdxs = [], hlState = 'visiting', prependNodes = [], prependState = 'neutral', appendNodes = [], appendState = 'neutral') {
    const allNodes = [
      ...prependNodes.map(n => ({ id: n.id, value: n.value, state: prependState })),
      ...list.map((n, i) => ({
        id:    n.id,
        value: n.value,
        state: highlightedIdxs.includes(i) ? hlState : 'neutral',
      })),
      ...appendNodes.map(n => ({ id: n.id, value: n.value, state: appendState })),
    ];
    return {
      type: 'queue',
      nodes: allNodes,
      pointers: { front: allNodes[0]?.id, rear: allNodes[allNodes.length - 1]?.id },
    };
  }

}
