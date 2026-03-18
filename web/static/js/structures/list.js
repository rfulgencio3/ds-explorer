/**
 * list.js — Simulação de Lista Dinâmica (array dinâmico / List<T>).
 *
 * Mantém o comportamento visual de um array sequencial, mas acompanha
 * capacidade interna e passos extras quando há realocação do buffer.
 */

function initStructurePage() {
  let data = [];
  let capacity = 0;

  const MAX_SIZE = 30;
  const BYTES_PER_ELEM = 4;
  const ELEMS_PER_LINE = 16;
  const BASE_ADDR = 0x1800;

  let _prevCacheLine = -1;

  const meta = window.__STRUCTURE_DATA__;
  const selectOp = document.getElementById('select-operation');
  const inputSize = document.getElementById('input-size');
  const btnGenerate = document.getElementById('btn-generate');
  const btnExecute = document.getElementById('btn-execute');
  const fieldValue = document.getElementById('field-value');
  const fieldIndex = document.getElementById('field-index');
  const fieldNewVal = document.getElementById('field-new-value');
  const inputValue = document.getElementById('input-value');
  const inputIndex = document.getElementById('input-index');
  const inputNewVal = document.getElementById('input-new-value');

  const fieldMap = StructureUI.DEFAULT_FIELD_MAP;

  function _syncFields() {
    StructureUI.syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, fieldMap);
  }
  selectOp.addEventListener('change', _syncFields);
  _syncFields();

  StructureUI.initMeta(meta, 'Lista Dinâmica');

  MemoryPanel.init('arraylist');

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(MAX_SIZE, Math.max(2, parseInt(inputSize.value, 10) || 6));
    data = Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 1);
    capacity = _nextCapacity(size);
    _prevCacheLine = -1;
    Animator.load([{
      description: `Lista dinâmica gerada com ${size} elementos e capacidade ${capacity}.`,
      snapshot: _snapshot(data, []),
      memory: _buildMemory(data, null),
    }]);
  });

  btnGenerate.click();

  btnExecute.addEventListener('click', () => {
    if (data.length === 0) { alert('Gere uma lista primeiro.'); return; }

    const op = selectOp.value;
    const value = parseInt(inputValue.value, 10);
    const index = parseInt(inputIndex.value, 10);
    const newVal = parseInt(inputNewVal.value, 10);

    let steps = [];
    _prevCacheLine = -1;

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
      const last = steps[steps.length - 1];
      data = last.snapshot.nodes.map((n) => n.value);
      capacity = last.capacity ?? capacity;
    }

    Animator.load(steps);
  });

  function _nextCapacity(size) {
    let next = 4;
    while (next < size && next < MAX_SIZE) next *= 2;
    return Math.min(next, MAX_SIZE);
  }

  function _addr(i) {
    const hex = (BASE_ADDR + i * BYTES_PER_ELEM).toString(16).toUpperCase();
    return '0x' + hex.padStart(4, '0');
  }

  function _cacheFor(idx) {
    const line = Math.floor(idx / ELEMS_PER_LINE);
    const hit = line === _prevCacheLine;
    _prevCacheLine = line;
    if (hit) {
      return {
        event: 'hit',
        cycles: 4,
        note: `Posição ${idx} ainda está na cache line ${line} do buffer atual.`,
      };
    }
    return {
      event: 'miss',
      cycles: 200,
      note: `Cache line ${line} não estava carregada; acesso ao buffer contíguo na RAM.`,
    };
  }

  function _buildMemory(arr, accessedIdx) {
    const cache = (accessedIdx != null && accessedIdx >= 0 && accessedIdx < arr.length)
      ? _cacheFor(accessedIdx)
      : { event: null, cycles: null, note: null };

    const layout = Array.from({ length: capacity }, (_, i) => ({
      value: i < arr.length ? arr[i] : '·',
      addr: _addr(i),
    }));

    return {
      type: 'arraylist',
      totalBytes: capacity * BYTES_PER_ELEM,
      event: cache.event,
      cycles: cache.cycles,
      note: cache.note || `Tamanho lógico ${arr.length}, capacidade ${capacity}.`,
      accessedIdx: (accessedIdx != null && accessedIdx >= 0) ? accessedIdx : null,
      layout,
    };
  }

  function _insertAt(arr, idx, val) {
    const steps = [];

    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    if (isNaN(idx) || idx < 0 || idx > arr.length) { alert('Índice inválido.'); return []; }
    if (arr.length >= MAX_SIZE) { alert(`A lista suporta no máximo ${MAX_SIZE} elementos.`); return []; }

    steps.push({
      description: `Inserir ${val} na posição ${idx}. Tamanho ${arr.length}, capacidade ${capacity}.`,
      snapshot: _snapshot(arr, []),
      memory: _buildMemory(arr, null),
      capacity,
    });

    if (arr.length === capacity) {
      const nextCapacity = Math.min(MAX_SIZE, Math.max(4, capacity * 2));
      steps.push({
        description: `Capacidade esgotada. Realocando buffer contíguo de ${capacity} para ${nextCapacity} posições.`,
        snapshot: _snapshot(arr, []),
        memory: {
          ..._buildMemory(arr, null),
          totalBytes: nextCapacity * BYTES_PER_ELEM,
          note: `Realocação: todos os ${arr.length} elementos são copiados para um novo buffer contíguo.`,
        },
        capacity: nextCapacity,
      });
      capacity = nextCapacity;
    }

    for (let i = arr.length - 1; i >= idx; i--) {
      const shifted = arr.slice();
      steps.push({
        description: `Deslocando valor ${shifted[i]} da posição ${i} para ${i + 1}.`,
        snapshot: _snapshot(shifted, [i], 'warning'),
        memory: _buildMemory(shifted, i),
        capacity,
      });
      arr.splice(i + 1, 0, arr[i]);
      arr.splice(i, 1);
    }

    arr.splice(idx, 0, val);
    steps.push({
      description: `Inserção concluída. Tamanho ${arr.length}, capacidade ${capacity}.`,
      snapshot: _snapshot(arr, [idx], 'success'),
      memory: _buildMemory(arr, idx),
      capacity,
    });

    return steps;
  }

  function _removeAt(arr, idx) {
    if (isNaN(idx) || idx < 0 || idx >= arr.length) { alert('Índice inválido.'); return []; }

    const steps = [];
    const removed = arr[idx];

    steps.push({
      description: `Remover posição ${idx} (valor ${removed}). Capacidade permanece ${capacity}.`,
      snapshot: _snapshot(arr, [idx], 'danger'),
      memory: _buildMemory(arr, idx),
      capacity,
    });

    arr.splice(idx, 1);

    for (let i = idx; i < arr.length; i++) {
      steps.push({
        description: `Deslocando valor ${arr[i]} para a posição ${i}.`,
        snapshot: _snapshot(arr, [i], 'warning'),
        memory: _buildMemory(arr, i),
        capacity,
      });
    }

    steps.push({
      description: `Remoção concluída. Tamanho ${arr.length}, capacidade ${capacity}.`,
      snapshot: _snapshot(arr, []),
      memory: _buildMemory(arr, null),
      capacity,
    });

    return steps;
  }

  function _removeByValue(arr, val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const steps = [{
      description: `Buscando valor ${val} para remover.`,
      snapshot: _snapshot(arr, []),
      memory: _buildMemory(arr, null),
      capacity,
    }];

    const idx = arr.indexOf(val);
    if (idx === -1) {
      steps.push({
        description: `Valor ${val} não foi encontrado.`,
        snapshot: _snapshot(arr, []),
        memory: _buildMemory(arr, null),
        capacity,
      });
      return steps;
    }

    steps.push({
      description: `Valor ${val} encontrado na posição ${idx}.`,
      snapshot: _snapshot(arr, [idx], 'danger'),
      memory: _buildMemory(arr, idx),
      capacity,
    });

    return steps.concat(_removeAt(arr, idx).slice(1));
  }

  function _search(arr, val) {
    if (isNaN(val)) { alert('Informe um valor.'); return []; }
    const steps = [{
      description: `Busca linear pelo valor ${val} no buffer dinâmico.`,
      snapshot: _snapshot(arr, []),
      memory: _buildMemory(arr, null),
      capacity,
    }];

    for (let i = 0; i < arr.length; i++) {
      const found = arr[i] === val;
      steps.push({
        description: `Comparando posição ${i} (valor ${arr[i]}) com ${val}.${found ? ' Encontrado.' : ''}`,
        snapshot: _snapshot(arr, [i], found ? 'success' : 'visiting'),
        memory: _buildMemory(arr, i),
        capacity,
      });
      if (found) return steps;
    }

    steps.push({
      description: `Busca concluída: ${val} não está na lista.`,
      snapshot: _snapshot(arr, []),
      memory: _buildMemory(arr, null),
      capacity,
    });
    return steps;
  }

  function _update(arr, idx, val) {
    if (isNaN(idx) || idx < 0 || idx >= arr.length) { alert('Índice inválido.'); return []; }
    if (isNaN(val)) { alert('Informe o novo valor.'); return []; }

    const old = arr[idx];
    const steps = [{
      description: `Acessando posição ${idx} (valor atual ${old}).`,
      snapshot: _snapshot(arr, [idx], 'visiting'),
      memory: _buildMemory(arr, idx),
      capacity,
    }];

    arr[idx] = val;
    steps.push({
      description: `Atualizando posição ${idx}: ${old} → ${val}.`,
      snapshot: _snapshot(arr, [idx], 'warning'),
      memory: _buildMemory(arr, idx),
      capacity,
    });
    steps.push({
      description: 'Atualização concluída.',
      snapshot: _snapshot(arr, [idx], 'success'),
      memory: _buildMemory(arr, idx),
      capacity,
    });
    return steps;
  }

  function _snapshot(arr, highlighted = [], hlState = 'visiting') {
    return {
      type: 'array',
      nodes: arr.map((v, i) => ({
        id: i,
        value: v,
        state: highlighted.includes(i) ? hlState : 'neutral',
      })),
    };
  }

}
