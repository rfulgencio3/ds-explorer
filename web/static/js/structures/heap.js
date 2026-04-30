/**
 * heap.js - simulacao de Min Heap binario usando array contiguo.
 */
function initStructurePage() {
  let data = [];
  const MAX_SIZE = 30;
  const BYTES_PER_ELEM = 4;
  const ELEMS_PER_LINE = 16;
  const BASE_ADDR = 0x8000;
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

  selectOp.innerHTML = `
    <optgroup label="Heap">
      <option value="insert">Insert</option>
      <option value="extractMin">Extract min</option>
      <option value="peek">Peek min</option>
      <option value="search">Buscar por valor</option>
    </optgroup>
  `;

  const fieldMap = { insert: ['value'], extractMin: [], peek: [], search: ['value'] };
  function _syncFields() { StructureUI.syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, fieldMap); }
  selectOp.addEventListener('change', _syncFields);
  _syncFields();

  StructureUI.initMeta(meta, 'Heap');
  MemoryPanel.init('heap');

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(MAX_SIZE, Math.max(2, parseInt(inputSize.value, 10) || 7));
    data = Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 1);
    _heapify(data);
    _prevCacheLine = -1;
    Animator.load([{
      description: `Min Heap gerado com ${size} elementos. A raiz fica em [0]; filhos de i ficam em 2i+1 e 2i+2.`,
      snapshot: _snapshot(data, [0], 'success'),
      memory: _buildMemory(data, null),
    }]);
  });
  btnGenerate.click();

  btnExecute.addEventListener('click', () => {
    if (data.length === 0 && selectOp.value !== 'insert') {
      alert('O heap esta vazio. Use insert para adicionar um valor.');
      return;
    }
    const op = selectOp.value;
    const value = parseInt(inputValue.value, 10);
    let steps = [];
    _prevCacheLine = -1;

    switch (op) {
      case 'insert': steps = _insert(value); break;
      case 'extractMin': steps = _extractMin(); break;
      case 'peek': steps = _peek(); break;
      case 'search': steps = _search(value); break;
    }

    if (steps.length > 0) {
      data = steps[steps.length - 1].snapshot.nodes.map(n => n.value);
      Animator.load(steps);
    }
  });

  function _addr(i) {
    const hex = (BASE_ADDR + i * BYTES_PER_ELEM).toString(16).toUpperCase();
    return '0x' + hex.padStart(4, '0');
  }

  function _cacheFor(idx) {
    const line = Math.floor(idx / ELEMS_PER_LINE);
    const hit = line === _prevCacheLine;
    _prevCacheLine = line;
    return hit
      ? { event: 'hit', cycles: 4, note: `Indice ${idx} ainda esta na cache line ${line}.` }
      : { event: 'miss', cycles: 200, note: `Acesso ao indice ${idx}; heap usa array contiguo, mas pula entre pai e filho.` };
  }

  function _buildMemory(arr, accessedIdx, note = null) {
    const cache = accessedIdx != null ? _cacheFor(accessedIdx) : { event: null, cycles: null, note: null };
    return {
      type: 'heap',
      totalBytes: arr.length * BYTES_PER_ELEM,
      event: cache.event,
      cycles: cache.cycles,
      note: note || cache.note || 'Heap binario armazenado em array contiguo.',
      accessedIdx: accessedIdx != null ? accessedIdx : null,
      layout: arr.map((value, i) => ({ value, addr: _addr(i) })),
    };
  }

  function _insert(value) {
    if (isNaN(value)) { alert('Informe um valor.'); return []; }
    if (data.length >= MAX_SIZE) { alert(`O heap suporta no maximo ${MAX_SIZE} elementos.`); return []; }

    const arr = data.slice();
    arr.push(value);
    let idx = arr.length - 1;
    const steps = [{
      description: `Insert ${value}: novo valor entra no proximo slot livre [${idx}].`,
      snapshot: _snapshot(arr, [idx], 'success'),
      memory: _buildMemory(arr, idx),
    }];

    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      steps.push({
        description: `heapifyUp: comparando filho [${idx}]=${arr[idx]} com pai [${parent}]=${arr[parent]}.`,
        snapshot: _snapshot(arr, [idx, parent], arr[idx] < arr[parent] ? 'warning' : 'visiting'),
        memory: _buildMemory(arr, parent),
      });
      if (arr[parent] <= arr[idx]) break;
      [arr[parent], arr[idx]] = [arr[idx], arr[parent]];
      idx = parent;
      steps.push({
        description: `Troca realizada. O menor valor sobe para preservar a propriedade de Min Heap.`,
        snapshot: _snapshot(arr, [idx], 'success'),
        memory: _buildMemory(arr, idx),
      });
    }

    steps.push({
      description: `Insert concluido. Raiz atual: ${arr[0]}. Custo O(log n).`,
      snapshot: _snapshot(arr, [idx], 'success'),
      memory: _buildMemory(arr, null),
    });
    return steps;
  }

  function _extractMin() {
    const arr = data.slice();
    const min = arr[0];
    const steps = [{
      description: `Extract min: removendo a raiz [0]=${min}.`,
      snapshot: _snapshot(arr, [0], 'danger'),
      memory: _buildMemory(arr, 0),
    }];

    if (arr.length === 1) {
      return [{
        description: `Extract min removeu ${min}; heap ficou vazio.`,
        snapshot: _snapshot([], []),
        memory: _buildMemory([], null),
      }];
    }

    arr[0] = arr.pop();
    steps.push({
      description: `Ultimo elemento movido para a raiz. Agora heapifyDown escolhe o menor filho.`,
      snapshot: _snapshot(arr, [0], 'warning'),
      memory: _buildMemory(arr, 0),
    });

    let idx = 0;
    while (true) {
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;
      let smallest = idx;
      if (left < arr.length && arr[left] < arr[smallest]) smallest = left;
      if (right < arr.length && arr[right] < arr[smallest]) smallest = right;

      const highlighted = [idx];
      if (left < arr.length) highlighted.push(left);
      if (right < arr.length) highlighted.push(right);
      steps.push({
        description: `heapifyDown: comparando no [${idx}] com filhos${left < arr.length ? ` [${left}]` : ''}${right < arr.length ? ` e [${right}]` : ''}.`,
        snapshot: _snapshot(arr, highlighted, smallest === idx ? 'visiting' : 'warning'),
        memory: _buildMemory(arr, idx),
      });

      if (smallest === idx) break;
      [arr[idx], arr[smallest]] = [arr[smallest], arr[idx]];
      idx = smallest;
      steps.push({
        description: `Troca com o menor filho. O valor deslocado desce um nivel.`,
        snapshot: _snapshot(arr, [idx], 'success'),
        memory: _buildMemory(arr, idx),
      });
    }

    steps.push({
      description: `Extract min concluiu removendo ${min}. Nova raiz: ${arr[0]}. Custo O(log n).`,
      snapshot: _snapshot(arr, [0], 'success'),
      memory: _buildMemory(arr, null),
    });
    return steps;
  }

  function _peek() {
    return [{
      description: `Peek min: a raiz [0] contem ${data[0]}. Operacao O(1).`,
      snapshot: _snapshot(data, [0], 'success'),
      memory: _buildMemory(data, 0),
    }];
  }

  function _search(value) {
    if (isNaN(value)) { alert('Informe um valor.'); return []; }
    const steps = [{ description: `Busca por ${value}. Heap nao e ordenado para busca arbitraria; o pior caso e O(n).`, snapshot: _snapshot(data), memory: _buildMemory(data, null) }];
    for (let i = 0; i < data.length; i++) {
      const found = data[i] === value;
      steps.push({
        description: `Passo ${i + 1}/${data.length}: comparando [${i}]=${data[i]} com ${value}. ${found ? 'ENCONTRADO!' : 'Continuar.'}`,
        snapshot: _snapshot(data, [i], found ? 'success' : 'visiting'),
        memory: _buildMemory(data, i),
      });
      if (found) return steps;
    }
    steps.push({ description: `Valor ${value} nao encontrado no heap.`, snapshot: _snapshot(data), memory: _buildMemory(data, null) });
    return steps;
  }

  function _heapify(arr) {
    for (let i = Math.floor(arr.length / 2) - 1; i >= 0; i--) _siftDown(arr, i);
  }

  function _siftDown(arr, idx) {
    while (true) {
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;
      let smallest = idx;
      if (left < arr.length && arr[left] < arr[smallest]) smallest = left;
      if (right < arr.length && arr[right] < arr[smallest]) smallest = right;
      if (smallest === idx) return;
      [arr[idx], arr[smallest]] = [arr[smallest], arr[idx]];
      idx = smallest;
    }
  }

  function _snapshot(arr, highlighted = [], state = 'visiting') {
    return {
      type: 'array',
      nodes: arr.map((value, i) => ({ id: i, value, state: highlighted.includes(i) ? state : 'neutral' })),
    };
  }
}
