/**
 * array.js — Lógica de simulação do Array Estático.
 *
 * Expõe initStructurePage() que é chamado após o carregamento do script.
 * Toda a simulação acontece no frontend; o Go não é consultado para as operações.
 */

function initStructurePage() {
  let data = [];
  const MAX_SIZE = 30;

  // ── UI ────────────────────────────────────────────────────────────────
  const { btnGenerate, btnExecute, inputSize, inputValue, inputIndex, inputNewVal } =
    StructureUI.bootstrap({ fallbackName: 'Array', memoryType: 'array' });

  // ── Memory ────────────────────────────────────────────────────────────
  const _mem = MemoryHelpers.forArray({ type: 'array', bytesPerElem: 4, elemsPerLine: 16, baseAddr: 0x1000 });

  // ── Generate ───────────────────────────────────────────────────────────
  btnGenerate.addEventListener('click', () => {
    const size = Math.min(MAX_SIZE, Math.max(2, parseInt(inputSize.value) || 6));
    data = Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 1);
    _mem.reset();
    Animator.load([{
      description: 'Array gerado com valores aleatórios.',
      snapshot: _snapshot(data, []),
      memory:   _buildMemory(data, null),
    }]);
  });

  // Auto-generate on load
  btnGenerate.click();

  // ── Execute ────────────────────────────────────────────────────────────
  btnExecute.addEventListener('click', () => {
    if (data.length === 0) { alert('Gere um array primeiro.'); return; }

    const op     = selectOp.value;
    const value  = parseInt(inputValue.value);
    const index  = parseInt(inputIndex.value);
    const newVal = parseInt(inputNewVal.value);

    let steps = [];
    _mem.reset();

    switch (op) {
      case 'insertBegin':   steps = _insertAt(data.slice(), 0, value); break;
      case 'insertEnd':     steps = _insertAt(data.slice(), data.length, value); break;
      case 'insertAt':      steps = _insertAt(data.slice(), index, value); break;
      case 'removeBegin':   steps = _removeAt(data.slice(), 0); break;
      case 'removeEnd':     steps = _removeAt(data.slice(), data.length - 1); break;
      case 'removeAt':      steps = _removeAt(data.slice(), index); break;
      case 'removeByValue': steps = _removeByValue(data.slice(), value); break;
      case 'search':        steps = _search(data.slice(), value); break;
      case 'update':        steps = _update(data.slice(), index, newVal); break;
      default:              return;
    }

    if (steps.length > 0) {
      const lastSnap = steps[steps.length - 1].snapshot;
      data = lastSnap.nodes.map(n => n.value);
    }

    Animator.load(steps);
  });

  function _buildMemory(arr, accessedIdx) { return _mem.buildMemory(arr, accessedIdx); }

  // ── Operations → steps ────────────────────────────────────────────────

  function _insertAt(arr, idx, val) {
    const steps = [];

    if (isNaN(val))  { alert('Informe um valor.'); return []; }
    if (isNaN(idx) || idx < 0 || idx > arr.length) { alert('Índice inválido.'); return []; }
    if (arr.length >= MAX_SIZE) { alert(`O array suporta no máximo ${MAX_SIZE} elementos.`); return []; }

    steps.push({
      description: `Inserir ${val} na posição ${idx}. Array tem ${arr.length} elementos.`,
      snapshot: _snapshot(arr, []),
      memory:   _buildMemory(arr, null),
    });

    // Shift: mover elementos para a direita, do fim até idx
    for (let i = arr.length - 1; i >= idx; i--) {
      const shifted = arr.slice();
      steps.push({
        description: `Passo ${steps.length}: Deslocando [${shifted[i]}] da posição ${i} → ${i + 1}.`,
        snapshot: _snapshot(shifted, [i], 'warning', i + 1, shifted[i], 'visiting'),
        memory:   _buildMemory(shifted, i),
      });
      arr.splice(i + 1, 0, arr[i]);
      arr.splice(i, 1);
    }

    arr.splice(idx, 0, val);
    steps.push({
      description: `Inserção concluída: valor ${val} na posição ${idx}.`,
      snapshot: _snapshot(arr, [idx], 'success'),
      memory:   _buildMemory(arr, idx),
    });

    return steps;
  }

  function _removeAt(arr, idx) {
    if (isNaN(idx) || idx < 0 || idx >= arr.length) { alert('Índice inválido.'); return []; }

    const steps  = [];
    const removed = arr[idx];

    steps.push({
      description: `Remover elemento na posição ${idx} (valor: ${removed}).`,
      snapshot: _snapshot(arr, [idx], 'danger'),
      memory:   _buildMemory(arr, idx),
    });

    arr.splice(idx, 1);

    for (let i = idx; i < arr.length; i++) {
      steps.push({
        description: `Passo ${steps.length}: Deslocando [${arr[i]}] da posição ${i + 1} → ${i}.`,
        snapshot: _snapshot(arr, [i], 'warning'),
        memory:   _buildMemory(arr, i),
      });
    }

    steps.push({
      description: `Remoção concluída. Elemento ${removed} removido.`,
      snapshot: _snapshot(arr, []),
      memory:   _buildMemory(arr, null),
    });

    return steps;
  }

  function _removeByValue(arr, val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const steps = [];

    steps.push({
      description: `Buscando valor ${val} para remover...`,
      snapshot: _snapshot(arr, []),
      memory:   _buildMemory(arr, null),
    });

    const idx = arr.indexOf(val);
    if (idx === -1) {
      steps.push({
        description: `Valor ${val} não encontrado no array.`,
        snapshot: _snapshot(arr, []),
        memory:   _buildMemory(arr, null),
      });
      return steps;
    }

    steps.push({
      description: `Valor ${val} encontrado na posição ${idx}. Removendo...`,
      snapshot: _snapshot(arr, [idx], 'danger'),
      memory:   _buildMemory(arr, idx),
    });

    return steps.concat(_removeAt(arr, idx).slice(1));
  }

  function _search(arr, val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const steps = [];
    const total = arr.length;

    steps.push({
      description: `Iniciando busca linear pelo valor ${val}...`,
      snapshot: _snapshot(arr, []),
      memory:   _buildMemory(arr, null),
    });

    for (let i = 0; i < arr.length; i++) {
      const isFound = arr[i] === val;
      steps.push({
        description: `Passo ${i + 1}/${total}: Comparando posição ${i} (valor ${arr[i]}) com ${val}. ${isFound ? 'ENCONTRADO!' : 'Diferente, continuar.'}`,
        snapshot: _snapshot(arr, [i], isFound ? 'success' : 'visiting'),
        memory:   _buildMemory(arr, i),
      });
      if (isFound) return steps;
    }

    steps.push({
      description: `Busca concluída: valor ${val} não encontrado no array.`,
      snapshot: _snapshot(arr, []),
      memory:   _buildMemory(arr, null),
    });

    return steps;
  }

  function _update(arr, idx, val) {
    if (isNaN(idx) || idx < 0 || idx >= arr.length) { alert('Índice inválido.'); return []; }
    if (isNaN(val)) { alert('Informe o novo valor.'); return []; }
    const steps = [];
    const old   = arr[idx];

    steps.push({
      description: `Acessando posição ${idx} (valor atual: ${old}).`,
      snapshot: _snapshot(arr, [idx], 'visiting'),
      memory:   _buildMemory(arr, idx),
    });

    arr[idx] = val;

    steps.push({
      description: `Posição ${idx} atualizada: ${old} → ${val}.`,
      snapshot: _snapshot(arr, [idx], 'warning'),
      memory:   _buildMemory(arr, idx),
    });

    steps.push({
      description: `Atualização concluída.`,
      snapshot: _snapshot(arr, [idx], 'success'),
      memory:   _buildMemory(arr, idx),
    });

    return steps;
  }

  // ── Snapshot helper ────────────────────────────────────────────────────
  function _snapshot(arr, highlighted = [], hlState = 'visiting', ghostIdx = -1, ghostVal = null, ghostState = 'warning') {
    const nodes = arr.map((v, i) => ({
      id:    i,
      value: v,
      state: highlighted.includes(i) ? hlState : 'neutral',
    }));

    if (ghostIdx >= 0 && ghostIdx < nodes.length) {
      nodes[ghostIdx].state = ghostState;
    }

    return { type: 'array', nodes };
  }

}
