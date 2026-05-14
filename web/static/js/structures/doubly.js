/**
 * doubly.js — Lógica de simulação da Lista Encadeada Dupla.
 *
 * Diferenças em relação à singly.js:
 * - type: 'doubly' no snapshot (renderer desenha setas prev)
 * - pointers inclui TAIL
 * - insertEnd é O(1) (TAIL conhecido)
 * - passos descrevem atualização de AMBOS os ponteiros (next e prev)
 */

function initStructurePage() {
  let nodes  = [];
  let nextId = 0;

  // ── UI ────────────────────────────────────────────────────────────────
  const { btnGenerate, btnExecute, inputSize, inputValue, inputIndex, inputNewVal } =
    StructureUI.bootstrap({ fallbackName: 'Lista Dupla', memoryType: 'doubly' });

  // ── Memory ────────────────────────────────────────────────────────────
  const _mem = MemoryHelpers.forLinked({
    type: 'doubly', bytesPerNode: 24, baseAddr: 0x3000,
    hashMult: 2246822519, rangeSize: 0x4000, alignMask: ~0x17,
  });

  function _buildMemory(nodeList, accessedNodeId) { return _mem.buildMemory(nodeList, accessedNodeId); }

  // ── Generate ─────────────────────────────────────────────────────────

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(30, Math.max(2, parseInt(inputSize.value) || 5));
    nodes = Array.from({ length: size }, () => ({ id: nextId++, value: Math.floor(Math.random() * 90) + 1 }));
    _mem.reset();
    Animator.load([{
      description: 'Lista dupla gerada com valores aleatórios.',
      snapshot: _snapshot(nodes, []),
      memory:   _buildMemory(nodes, null),
    }]);
  });
  btnGenerate.click();

  // ── Execute ─────────────────────────────────────────────────────────

  btnExecute.addEventListener('click', () => {
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
    const list = nodes.slice();
    const n    = { id: nextId++, value: val };
    const steps = [];

    steps.push({
      description: `Criar novo nó com valor ${val}.`,
      snapshot: _snapshot(list, [], 'neutral', [n], 'success'),
      memory:   _buildMemory([n, ...list], n.id),
    });

    steps.push({
      description: `Novo nó.next → antigo HEAD (${list[0]?.value ?? 'null'}); antigo HEAD.prev → novo nó.`,
      snapshot: _snapshot(list, list.length > 0 ? [0] : [], 'visiting', [n], 'success'),
      memory:   _buildMemory([n, ...list], list[0]?.id ?? null),
    });

    const result = [n, ...list];
    steps.push({
      description: `HEAD atualizado para o novo nó. Inserção no início concluída — O(1).`,
      snapshot: _snapshot(result, [0], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _insertEnd(val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const list = nodes.slice();
    const n    = { id: nextId++, value: val };
    const steps = [];

    steps.push({
      description: `Inserir ${val} no fim. Com TAIL disponível, acesso direto em O(1) — sem percorrer a lista.`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    if (list.length > 0) {
      steps.push({
        description: `TAIL aponta para o nó ${list[list.length - 1].value}. Novo nó.prev → TAIL; TAIL.next → novo nó.`,
        snapshot: _snapshot(list, [list.length - 1], 'warning', [n], 'success'),
        memory:   _buildMemory([...list, n], list[list.length - 1].id),
      });
    }

    const result = [...list, n];
    steps.push({
      description: `TAIL atualizado para o novo nó. Inserção no fim concluída — O(1) graças ao ponteiro TAIL.`,
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

    const list = nodes.slice();
    const n    = { id: nextId++, value: val };
    const steps = [];

    steps.push({
      description: `Inserir ${val} na posição ${idx}. Percorrendo...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i <= idx; i++) {
      steps.push({
        description: `Passo ${i + 1}: Nó ${i} (valor ${list[i]?.value}).${i === idx - 1 ? ' Predecessor encontrado.' : i === idx ? ' Nó que será deslocado.' : ''}`,
        snapshot: _snapshot(list, [i], i === idx - 1 ? 'warning' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    steps.push({
      description: `Novo nó.next → nó ${idx}; novo nó.prev → nó ${idx - 1}. Atualizar ponteiros dos vizinhos.`,
      snapshot: _snapshot(list, [idx - 1, idx], 'warning', [n], 'success'),
      memory:   _buildMemory(list, list[idx - 1].id),
    });

    const result = [...list.slice(0, idx), n, ...list.slice(idx)];
    steps.push({
      description: `Nó ${idx - 1}.next e nó ${idx + 1}.prev atualizados. Inserção concluída.`,
      snapshot: _snapshot(result, [idx], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _removeBegin() {
    if (nodes.length === 0) { alert('Lista vazia.'); return []; }
    const list = nodes.slice();
    const steps = [];

    steps.push({
      description: `Remover HEAD (valor: ${list[0].value}). HEAD.next.prev será definido como null.`,
      snapshot: _snapshot(list, [0], 'danger'),
      memory:   _buildMemory(list, list[0].id),
    });

    if (list.length > 1) {
      steps.push({
        description: `Novo HEAD será o nó ${list[1].value}. Seu ponteiro prev definido como null.`,
        snapshot: _snapshot(list, [0, 1], 'warning'),
        memory:   _buildMemory(list, list[1].id),
      });
    }

    const result = list.slice(1);
    steps.push({
      description: `HEAD atualizado. Nó ${list[0].value} removido — O(1).`,
      snapshot: _snapshot(result, result.length > 0 ? [0] : [], 'success'),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _removeEnd() {
    if (nodes.length === 0) { alert('Lista vazia.'); return []; }
    const list = nodes.slice();
    const steps = [];

    steps.push({
      description: `Remover TAIL (valor: ${list[list.length - 1].value}). Com TAIL: acesso direto em O(1).`,
      snapshot: _snapshot(list, [list.length - 1], 'danger'),
      memory:   _buildMemory(list, list[list.length - 1].id),
    });

    if (list.length > 1) {
      steps.push({
        description: `Novo TAIL será o nó ${list[list.length - 2].value}. Seu ponteiro next definido como null.`,
        snapshot: _snapshot(list, [list.length - 2, list.length - 1], 'warning'),
        memory:   _buildMemory(list, list[list.length - 2].id),
      });
    }

    const result = list.slice(0, -1);
    steps.push({
      description: `TAIL atualizado. Nó ${list[list.length - 1].value} removido — O(1) graças ao TAIL.`,
      snapshot: _snapshot(result, []),
      memory:   _buildMemory(result, null),
    });

    return steps;
  }

  function _removeAt(idx) {
    if (isNaN(idx) || idx < 0 || idx >= nodes.length) { alert('Índice inválido.'); return []; }
    if (idx === 0) return _removeBegin();
    if (idx === nodes.length - 1) return _removeEnd();

    const list = nodes.slice();
    const steps = [];

    steps.push({
      description: `Remover nó na posição ${idx}. Percorrendo...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i <= idx; i++) {
      steps.push({
        description: `Passo ${i + 1}: Visitando nó ${i} (valor ${list[i].value}).${i === idx ? ' Nó a remover.' : ''}`,
        snapshot: _snapshot(list, [i], i === idx ? 'danger' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
    }

    steps.push({
      description: `Atualizando: nó ${idx - 1}.next → nó ${idx + 1}; nó ${idx + 1}.prev → nó ${idx - 1}.`,
      snapshot: _snapshot(list, [idx - 1, idx, idx + 1], 'warning'),
      memory:   _buildMemory(list, list[idx - 1].id),
    });

    const result = [...list.slice(0, idx), ...list.slice(idx + 1)];
    steps.push({
      description: `Nó ${list[idx].value} removido. Ambos os ponteiros atualizados — lista permanece bidirecional.`,
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
        description: `Passo ${i + 1}: Nó ${i} (valor ${list[i].value}). ${found ? 'ENCONTRADO!' : 'Avançar.'}`,
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
      description: `Busca linear pelo valor ${val} a partir do HEAD...`,
      snapshot: _snapshot(list, []),
      memory:   _buildMemory(list, null),
    });

    for (let i = 0; i < list.length; i++) {
      const found = list[i].value === val;
      steps.push({
        description: `Passo ${i + 1}/${list.length}: Nó ${i} tem valor ${list[i].value}. ${found ? 'ENCONTRADO!' : 'Avançar via next.'}`,
        snapshot: _snapshot(list, [i], found ? 'success' : 'visiting'),
        memory:   _buildMemory(list, list[i].id),
      });
      if (found) return steps;
    }

    steps.push({
      description: `Valor ${val} não encontrado.`,
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
      description: `Nó ${idx} atualizado: ${list[idx].value} → ${val}. Ponteiros não precisam ser alterados.`,
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
    const headId = allNodes[0]?.id;
    const tailId = allNodes[allNodes.length - 1]?.id;
    return { type: 'doubly', nodes: allNodes, pointers: { HEAD: headId, TAIL: tailId } };
  }

}
