/**
 * singly.js — Lógica de simulação da Lista Encadeada Simples.
 *
 * Estado interno: array de objetos { id, value }
 * O "id" é um número único por nó (sobrevive a reordenações).
 */

function initStructurePage() {
  let nodes  = [];
  let nextId = 0;

  // ── UI ────────────────────────────────────────────────────────────────
  const { btnGenerate, btnExecute, inputSize, inputValue, inputIndex, inputNewVal } =
    StructureUI.bootstrap({ fallbackName: 'Lista Simples', memoryType: 'singly' });

  // ── Memory ────────────────────────────────────────────────────────────
  const _mem = MemoryHelpers.forLinked({
    type: 'singly', bytesPerNode: 16, baseAddr: 0x2000,
    hashMult: 2654435761, rangeSize: 0x4000, alignMask: ~0xF,
  });

  function _buildMemory(nodeList, accessedNodeId) { return _mem.buildMemory(nodeList, accessedNodeId); }

  // ── Generate ─────────────────────────────────────────────────────────

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(30, Math.max(2, parseInt(inputSize.value) || 5));
    nodes = Array.from({ length: size }, () => ({ id: nextId++, value: Math.floor(Math.random() * 90) + 1 }));
    _mem.reset();
    Animator.load([{
      description: 'Lista gerada com valores aleatórios.',
      snapshot: _snapshot(nodes, []),
      memory:   _buildMemory(nodes, null),
    }]);
  });
  btnGenerate.click();

  // ── Execute ────────────────────────────────────────────────────────────

  btnExecute.addEventListener('click', () => {
    if (nodes.length === 0 && !['insertBegin','insertEnd'].includes(selectOp.value)) {
      alert('Gere uma lista primeiro.');
      return;
    }

    const op     = selectOp.value;
    const value  = parseInt(inputValue.value);
    const index  = parseInt(inputIndex.value);
    const newVal = parseInt(inputNewVal.value);
    let steps    = [];
    _mem.reset();

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
      const lastSnap = steps[steps.length - 1].snapshot;
      nodes = lastSnap.nodes.map(n => ({ id: n.id, value: n.value }));
    }

    Animator.load(steps);
  });

  // ── Operations ────────────────────────────────────────────────────────

  function _insertBegin(val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const list    = nodes.slice();
    const newNode = { id: nextId++, value: val };
    const steps   = [];

    steps.push({
      description: `Inserir ${val} no início. Criar novo nó com valor ${val}.`,
      snapshot: _snapshot(list, [], 'neutral', [newNode], 'success'),
      memory:   _buildMemory([newNode, ...list], newNode.id),
    });

    steps.push({
      description: `Passo 2: O novo nó aponta para o antigo HEAD (${list[0]?.value ?? 'null'}).`,
      snapshot: _snapshot(list, list.length > 0 ? [0] : [], 'visiting', [newNode], 'success'),
      memory:   _buildMemory([newNode, ...list], list[0]?.id ?? null),
    });

    const result = [newNode, ...list];
    steps.push({
      description: `Passo 3: HEAD atualizado para o novo nó. Inserção concluída — O(1).`,
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
    const total   = list.length + 2;

    steps.push({
      description: `Inserir ${val} no fim. Percorrer lista até o último nó...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < list.length; i++) {
      steps.push({
        description: `Passo ${i + 1}/${total}: Visitando nó ${i} (valor ${list[i].value}). ${i === list.length - 1 ? 'Este é o último nó.' : 'Não é o último, avançar via next.'}`,
        snapshot: _snapshot(list, [i], 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    const result = [...list, newNode];
    steps.push({
      description: `Passo ${total}: Ponteiro next do último nó aponta para o novo nó. Inserção concluída.`,
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
      description: `Inserir ${val} na posição ${idx}. Percorrendo até o nó anterior (posição ${idx - 1})...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < idx; i++) {
      steps.push({
        description: `Passo ${i + 1}: Visitando nó ${i} (valor ${list[i].value}).${i === idx - 1 ? ' Este é o nó predecessor.' : ''}`,
        snapshot: _snapshot(list, [i], i === idx - 1 ? 'warning' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    steps.push({
      description: `Passo ${idx + 1}: Novo nó aponta para o nó que estava na posição ${idx} (valor ${list[idx].value}).`,
      snapshot: _snapshot(list, [idx - 1, idx], 'visiting', [newNode], 'success'),
      memory:   _buildMemory(list, list[idx].id),
    });

    const result = [...list.slice(0, idx), newNode, ...list.slice(idx)];
    steps.push({
      description: `Passo ${idx + 2}: Ponteiro next do nó ${idx - 1} atualizado. Inserção concluída.`,
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
      description: `Remover HEAD (valor: ${removed.value}). HEAD atual será desconectado.`,
      snapshot: _snapshot(list, [0], 'danger'),
      memory:   _buildMemory(list, removed.id),
    });

    const result = list.slice(1);
    steps.push({
      description: `HEAD atualizado para o próximo nó${result[0] ? ` (valor ${result[0].value})` : ' (lista vazia)'}. Nó ${removed.value} removido — O(1).`,
      snapshot: _snapshot(result, result.length > 0 ? [0] : [], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _removeEnd() {
    if (nodes.length === 0) { alert('Lista vazia.'); return []; }
    const list  = nodes.slice();
    const steps = [];
    const total = list.length + 1;

    steps.push({
      description: `Remover o último nó. Percorrendo até o penúltimo...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < list.length - 1; i++) {
      steps.push({
        description: `Passo ${i + 1}/${total}: Visitando nó ${i} (valor ${list[i].value}). ${i === list.length - 2 ? 'Este é o penúltimo nó.' : 'Avançar.'}`,
        snapshot: _snapshot(list, [i], i === list.length - 2 ? 'warning' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    const removed = list[list.length - 1];
    steps.push({
      description: `Nó ${removed.value} (posição ${list.length - 1}) marcado para remoção.`,
      snapshot: _snapshot(list, [list.length - 1], 'danger'),
      memory:   _buildMemory(list, removed.id),
    });

    const result = list.slice(0, -1);
    steps.push({
      description: `Ponteiro next do penúltimo nó definido como null. Nó ${removed.value} removido.`,
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
      description: `Remover nó na posição ${idx}. Percorrendo até o predecessor...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i <= idx; i++) {
      const isTarget = i === idx;
      const isPred   = i === idx - 1;
      steps.push({
        description: `Passo ${i + 1}: Visitando nó ${i} (valor ${list[i].value}).${isPred ? ' Predecessor encontrado.' : isTarget ? ' Nó a remover.' : ''}`,
        snapshot: _snapshot(list, [i], isPred ? 'warning' : isTarget ? 'danger' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    steps.push({
      description: `Passo ${idx + 2}: Atualizando ponteiro next do nó ${idx - 1} para apontar para o nó ${idx + 1}.`,
      snapshot: _snapshot(list, [idx - 1, idx, idx + 1], 'warning'),
      memory:   _buildMemory(list, list[idx - 1].id),
    });

    const result = [...list.slice(0, idx), ...list.slice(idx + 1)];
    steps.push({
      description: `Nó ${list[idx].value} removido. Ponteiros atualizados.`,
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
      description: `Buscar valor ${val} para remover...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    const idx = list.findIndex(n => n.value === val);
    if (idx === -1) {
      steps.push({
        description: `Valor ${val} não encontrado.`,
        snapshot: _snapshot(list, []),
        memory:   _buildMemory(list, null),
      });
      return steps;
    }

    for (let i = 0; i <= idx; i++) {
      const found = i === idx;
      steps.push({
        description: `Passo ${i + 1}: Nó ${i} tem valor ${list[i].value}. ${found ? 'ENCONTRADO!' : 'Diferente, avançar.'}`,
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
      description: `Busca linear pelo valor ${val}. Percorrendo a partir do HEAD...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < list.length; i++) {
      const found = list[i].value === val;
      steps.push({
        description: `Passo ${i + 1}/${list.length}: Nó ${i} tem valor ${list[i].value}. ${found ? 'ENCONTRADO!' : 'Diferente, avançar via next.'}`,
        snapshot: _snapshot(list, [i], found ? 'success' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
      if (found) return steps;
    }

    steps.push({
      description: `Valor ${val} não encontrado. Chegou ao null.`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });
    return steps;
  }

  function _update(idx, val) {
    if (isNaN(idx) || idx < 0 || idx >= nodes.length) { alert('Índice inválido.'); return []; }
    if (isNaN(val)) { alert('Informe o novo valor.'); return []; }

    const list  = nodes.slice();
    const steps = [];

    steps.push({
      description: `Atualizar nó na posição ${idx}. Percorrendo...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

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
    return { type: 'singly', nodes: allNodes, pointers: { HEAD: allNodes[0]?.id } };
  }

}
