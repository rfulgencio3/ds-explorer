/**
 * circular-list.js — Lista Circular Encadeada.
 *
 * Igual à lista simples, mas:
 *   - O último nó aponta de volta para o HEAD (snapshot type: 'circular').
 *   - Operações de inserção/remoção precisam atualizar o ponteiro do tail.
 *   - Busca encerra quando retorna ao HEAD (sem null terminal).
 */

function initStructurePage() {
  let nodes  = [];
  let nextId = 0;

  // Mesmas constantes de memória da lista simples (mesmo layout de nó)
  const BYTES_PER_NODE = 16;
  const BASE_ADDR      = 0x4000;
  let _prevAccessedId  = -1;

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
  const inputIndex  = document.getElementById('input-index');
  const inputNewVal = document.getElementById('input-new-value');

  const fieldMap = StructureUI.DEFAULT_FIELD_MAP;

  function _syncFields() {
    StructureUI.syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, fieldMap);
  }
  selectOp.addEventListener('change', _syncFields);
  _syncFields();

  StructureUI.initMeta(meta, 'Lista Circular');

  MemoryPanel.init('singly');  // mesmos parâmetros de memória que lista simples

  // ── Memory helpers ─────────────────────────────────────────────────────

  function _nodeAddr(id) {
    const offset  = ((id * 2246822519) >>> 0) % 0x4000;
    const aligned = offset & ~0xF;
    const hex = (BASE_ADDR + aligned).toString(16).toUpperCase();
    return '0x' + hex.padStart(4, '0');
  }

  function _cacheFor(nodeId) {
    const hit = nodeId === _prevAccessedId;
    _prevAccessedId = nodeId;
    if (hit) {
      return { event: 'hit',  cycles: 4,   note: 'Nó ainda presente no cache L1' };
    }
    return {
      event:  'miss',
      cycles: 200,
      note:   `Ponteiro circular aponta para ${_nodeAddr(nodeId)} — endereço heap não contíguo`,
    };
  }

  function _buildMemory(nodeList, accessedNodeId) {
    const totalBytes = nodeList.length * BYTES_PER_NODE;
    const cache = (accessedNodeId != null && accessedNodeId >= 0)
      ? _cacheFor(accessedNodeId)
      : { event: null, cycles: null, note: null };

    const layout     = nodeList.map(n => ({ value: n.value, addr: _nodeAddr(n.id) }));
    const accessedIdx = (accessedNodeId != null)
      ? nodeList.findIndex(n => n.id === accessedNodeId)
      : null;

    return {
      type:        'singly',
      totalBytes,
      event:       cache.event,
      cycles:      cache.cycles,
      note:        cache.note,
      accessedIdx: accessedIdx >= 0 ? accessedIdx : null,
      layout,
    };
  }

  // ── Generate ───────────────────────────────────────────────────────────

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(30, Math.max(2, parseInt(inputSize.value) || 5));
    nodes = Array.from({ length: size }, () => ({ id: nextId++, value: Math.floor(Math.random() * 90) + 1 }));
    _prevAccessedId = -1;
    Animator.load([{
      description: `Lista circular gerada com ${size} nós. O último nó aponta de volta para HEAD — sem null terminal.`,
      snapshot: _snapshot(nodes, []),
      memory:   _buildMemory(nodes, null),
    }]);
  });
  btnGenerate.click();

  // ── Execute ────────────────────────────────────────────────────────────

  btnExecute.addEventListener('click', () => {
    if (nodes.length === 0 && !['insertBegin', 'insertEnd'].includes(selectOp.value)) {
      alert('Gere uma lista primeiro.');
      return;
    }
    const op     = selectOp.value;
    const value  = parseInt(inputValue.value);
    const index  = parseInt(inputIndex.value);
    const newVal = parseInt(inputNewVal.value);
    let steps    = [];
    _prevAccessedId = -1;

    switch (op) {
      case 'insertBegin':   steps = _insertBegin(value); break;
      case 'insertEnd':     steps = _insertEnd(value); break;
      case 'insertAt':      steps = _insertAt(index, value); break;
      case 'removeBegin':   steps = _removeBegin(); break;
      case 'removeEnd':     steps = _removeEnd(); break;
      case 'removeAt':      steps = _removeAt(index); break;
      case 'removeByValue': steps = _removeByValue(value); break;
      case 'search':        steps = _search(value); break;
      case 'update':        steps = _update(index, newVal); break;
    }

    if (steps.length > 0) {
      nodes = steps[steps.length - 1].snapshot.nodes.map(n => ({ id: n.id, value: n.value }));
    }
    Animator.load(steps);
  });

  // ── Operations ─────────────────────────────────────────────────────────

  function _insertBegin(val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const list    = nodes.slice();
    const newNode = { id: nextId++, value: val };
    const steps   = [];

    steps.push({
      description: `Inserir ${val} no início. Em lista circular, o tail (nó ${list[list.length - 1]?.value}) precisa ser atualizado para apontar para o novo HEAD.`,
      snapshot: _snapshot(list, [list.length - 1], 'warning'),
      memory:   _buildMemory(list, list[list.length - 1]?.id ?? null),
    });

    // Percorrer até o tail para atualizá-lo
    for (let i = 0; i < list.length - 1; i++) {
      steps.push({
        description: `Passo ${i + 1}/${list.length}: Percorrendo via ↺ para encontrar o tail. Nó ${i} (valor ${list[i].value}).`,
        snapshot: _snapshot(list, [i], 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    steps.push({
      description: `Tail encontrado (valor ${list[list.length - 1].value}). Novo nó → HEAD antigo; tail.next → novo nó.`,
      snapshot: _snapshot(list, [list.length - 1], 'warning', [newNode], 'success'),
      memory:   _buildMemory([newNode, ...list], newNode.id),
    });

    const result = [newNode, ...list];
    steps.push({
      description: `HEAD atualizado. Inserção circular concluída. O ponteiro ↺ do tail aponta para o novo HEAD (${val}).`,
      snapshot: _snapshot(result, [0], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _insertEnd(val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const list    = nodes.slice();
    const newNode = { id: nextId++, value: val };
    const steps   = [];

    steps.push({
      description: `Inserir ${val} no fim. Percorrendo via ↺ até o tail (último nó que aponta para HEAD)...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < list.length; i++) {
      const isTail = i === list.length - 1;
      steps.push({
        description: `Passo ${i + 1}/${list.length}: Nó ${i} (valor ${list[i].value}). ${isTail ? 'Tail encontrado — next aponta para HEAD.' : 'next não é HEAD, avançar.'}`,
        snapshot: _snapshot(list, [i], isTail ? 'warning' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    const result = [...list, newNode];
    steps.push({
      description: `Tail.next agora aponta para ${val}; novo nó.next ↺ aponta para HEAD (${list[0]?.value}). Inserção concluída.`,
      snapshot: _snapshot(result, [result.length - 1], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _insertAt(idx, val) {
    if (isNaN(val))  { alert('Informe um valor.'); return []; }
    if (isNaN(idx) || idx < 0 || idx > nodes.length) { alert('Índice inválido.'); return []; }
    if (idx === 0) return _insertBegin(val);
    if (idx === nodes.length) return _insertEnd(val);

    const list    = nodes.slice();
    const newNode = { id: nextId++, value: val };
    const steps   = [];

    steps.push({
      description: `Inserir ${val} na posição ${idx}. Percorrendo até o predecessor (posição ${idx - 1})...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < idx; i++) {
      steps.push({
        description: `Passo ${i + 1}: Nó ${i} (valor ${list[i].value}).${i === idx - 1 ? ' Predecessor encontrado.' : ''}`,
        snapshot: _snapshot(list, [i], i === idx - 1 ? 'warning' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    steps.push({
      description: `Novo nó (${val}) aponta para nó ${idx} (${list[idx].value}); predecessor aponta para novo nó.`,
      snapshot: _snapshot(list, [idx - 1, idx], 'visiting', [newNode], 'success'),
      memory:   _buildMemory(list, list[idx].id),
    });

    const result = [...list.slice(0, idx), newNode, ...list.slice(idx)];
    steps.push({
      description: `Inserção concluída. Ponteiro ↺ do tail permanece apontando para HEAD.`,
      snapshot: _snapshot(result, [idx], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _removeBegin() {
    if (nodes.length === 0) { alert('Lista vazia.'); return []; }
    const list    = nodes.slice();
    const removed = list[0];
    const steps   = [];

    steps.push({
      description: `Remover HEAD (valor: ${removed.value}). O tail (${list[list.length - 1].value}) precisa ser atualizado para apontar para o novo HEAD.`,
      snapshot: _snapshot(list, [0, list.length - 1], 'danger'),
      memory:   _buildMemory(list, removed.id),
    });

    // Percorrer até o tail
    for (let i = 0; i < list.length - 1; i++) {
      steps.push({
        description: `Percorrendo ↺ para encontrar o tail. Nó ${i} (valor ${list[i].value}).`,
        snapshot: _snapshot(list, [i], i === list.length - 2 ? 'warning' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    const result = list.slice(1);
    const newHead = result[0]?.value ?? '(vazio)';
    steps.push({
      description: `Tail.next atualizado para o novo HEAD (${newHead}). Nó ${removed.value} removido.`,
      snapshot: _snapshot(result, result.length > 0 ? [0] : [], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _removeEnd() {
    if (nodes.length === 0) { alert('Lista vazia.'); return []; }
    const list  = nodes.slice();
    const steps = [];

    steps.push({
      description: `Remover o último nó. Percorrendo ↺ até o penúltimo...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < list.length - 1; i++) {
      const isPenult = i === list.length - 2;
      steps.push({
        description: `Passo ${i + 1}/${list.length}: Nó ${i} (valor ${list[i].value}).${isPenult ? ' Penúltimo encontrado.' : ''}`,
        snapshot: _snapshot(list, [i], isPenult ? 'warning' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    const removed = list[list.length - 1];
    steps.push({
      description: `Nó ${removed.value} marcado para remoção. Penúltimo.next ↺ apontará para HEAD (${list[0].value}).`,
      snapshot: _snapshot(list, [list.length - 1], 'danger'),
      memory:   _buildMemory(list, removed.id),
    });

    const result = list.slice(0, -1);
    steps.push({
      description: `Penúltimo agora é o novo tail; next ↺ aponta para HEAD. Nó ${removed.value} removido.`,
      snapshot: _snapshot(result, []),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _removeAt(idx) {
    if (isNaN(idx) || idx < 0 || idx >= nodes.length) { alert('Índice inválido.'); return []; }
    if (idx === 0) return _removeBegin();
    if (idx === nodes.length - 1) return _removeEnd();

    const list  = nodes.slice();
    const steps = [];

    steps.push({
      description: `Remover nó na posição ${idx}. Percorrendo ↺ até o predecessor...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i <= idx; i++) {
      const isTarget = i === idx;
      const isPred   = i === idx - 1;
      steps.push({
        description: `Passo ${i + 1}: Nó ${i} (valor ${list[i].value}).${isPred ? ' Predecessor.' : isTarget ? ' Nó a remover.' : ''}`,
        snapshot: _snapshot(list, [i], isPred ? 'warning' : isTarget ? 'danger' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    const result = [...list.slice(0, idx), ...list.slice(idx + 1)];
    steps.push({
      description: `Predecessor.next agora aponta para nó ${idx + 1}. Ponteiro ↺ do tail inalterado.`,
      snapshot: _snapshot(result, []),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _removeByValue(val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const list  = nodes.slice();
    const steps = [];

    steps.push({
      description: `Buscar ${val} na lista circular. Percorrendo ↺ a partir do HEAD...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    const idx = list.findIndex(n => n.value === val);
    if (idx === -1) {
      for (let i = 0; i < list.length; i++) {
        steps.push({
          description: `Nó ${i} (valor ${list[i].value}) — diferente. ${i === list.length - 1 ? 'Voltou ao HEAD — valor não encontrado.' : 'Avançar.'}`,
          snapshot: _snapshot(list, [i], 'visiting'),
          memory:   _buildMemory(list, list[i].id),
        });
      }
      steps.push({ description: `Valor ${val} não encontrado na lista circular.`, snapshot: _snapshot(list, []), memory: _buildMemory(list, null) });
      return steps;
    }

    for (let i = 0; i <= idx; i++) {
      const found = i === idx;
      steps.push({
        description: `Nó ${i} (valor ${list[i].value}). ${found ? 'ENCONTRADO!' : 'Diferente, avançar ↺.'}`,
        snapshot: _snapshot(list, [i], found ? 'danger' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    return steps.concat(_removeAt(idx).slice(1));
  }

  function _search(val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const list  = nodes.slice();
    const steps = [];

    steps.push({
      description: `Busca circular pelo valor ${val}. A partir do HEAD, avançando ↺ — para quando voltar ao HEAD.`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < list.length; i++) {
      const found = list[i].value === val;
      const isLast = i === list.length - 1;
      steps.push({
        description: `Passo ${i + 1}/${list.length}: Nó ${i} (valor ${list[i].value}). ${found ? 'ENCONTRADO!' : isLast ? 'Voltando ao HEAD — não encontrado.' : 'Diferente, avançar ↺.'}`,
        snapshot: _snapshot(list, [i], found ? 'success' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
      if (found) return steps;
    }

    steps.push({ description: `Valor ${val} não encontrado.`, snapshot: _snapshot(list, []), memory: _buildMemory(list, null) });
    return steps;
  }

  function _update(idx, val) {
    if (isNaN(idx) || idx < 0 || idx >= nodes.length) { alert('Índice inválido.'); return []; }
    if (isNaN(val)) { alert('Informe o novo valor.'); return []; }

    const list  = nodes.slice();
    const steps = [];

    steps.push({ description: `Atualizar posição ${idx}. Percorrendo ↺...`, snapshot: _snapshot(list, []), memory: _buildMemory(list, null) });

    for (let i = 0; i <= idx; i++) {
      steps.push({
        description: `Passo ${i + 1}: Nó ${i} (valor ${list[i].value}).${i === idx ? ' Posição encontrada.' : ''}`,
        snapshot: _snapshot(list, [i], i === idx ? 'warning' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    const result = list.map((n, i) => i === idx ? { ...n, value: val } : n);
    steps.push({
      description: `Nó ${idx} atualizado: ${list[idx].value} → ${val}.`,
      snapshot: _snapshot(result, [idx], 'success'),
      memory:   _buildMemory(result, null),
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
    return { type: 'circular', nodes: allNodes, pointers: { HEAD: allNodes[0]?.id } };
  }

}
