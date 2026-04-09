/**
 * circular-queue.js — Lógica de simulação da Fila Circular.
 *
 * Representação:
 * - buffer fixo e contíguo
 * - front aponta para o próximo elemento a sair
 * - rear aponta para o elemento mais recente
 */

function initStructurePage() {
  let buffer = [];
  let capacity = 8;
  let head = 0;
  let count = 0;

  const MAX_CAPACITY = 16;
  const BYTES_PER_ELEM = 4;
  const ELEMS_PER_LINE = 16;
  const BASE_ADDR = 0x6000;

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

  inputSize.max = '12';
  inputSize.value = inputSize.value || '6';

  selectOp.innerHTML = `
    <optgroup label="Fila Circular">
      <option value="enqueue">Enqueue (inserir no rear)</option>
      <option value="dequeue">Dequeue (remover do front)</option>
      <option value="peek">Peek (ver frente)</option>
      <option value="search">Buscar por valor</option>
    </optgroup>
  `;

  const fieldMap = {
    enqueue: ['value'],
    dequeue: [],
    peek: [],
    search: ['value'],
  };

  function _syncFields() {
    StructureUI.syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, fieldMap);
  }
  selectOp.addEventListener('change', _syncFields);
  _syncFields();

  StructureUI.initMeta(meta, 'Fila Circular');
  MemoryPanel.init('circular-queue');

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(10, Math.max(2, parseInt(inputSize.value, 10) || 6));
    capacity = _nextCapacity(size + 2);
    buffer = Array(capacity).fill(null);
    head = Math.floor(Math.random() * capacity);
    count = size;

    for (let i = 0; i < size; i++) {
      buffer[_physicalIdx(i, head, capacity)] = Math.floor(Math.random() * 90) + 1;
    }

    _prevCacheLine = -1;
    Animator.load([{
      description: `Fila circular gerada com ${size} elementos em buffer de capacidade ${capacity}. front e rear podem dar wrap sem deslocar elementos.`,
      snapshot: _snapshot(buffer, count, head),
      memory: _buildMemory(buffer, null, `Buffer contíguo de ${capacity} slots; ocupação atual ${count}.`),
    }]);
  });
  btnGenerate.click();

  btnExecute.addEventListener('click', () => {
    if (count === 0 && selectOp.value !== 'enqueue') {
      alert('A fila circular está vazia. Use enqueue para inserir um novo elemento.');
      return;
    }

    const op = selectOp.value;
    const value = parseInt(inputValue.value, 10);
    let result = { steps: [] };
    _prevCacheLine = -1;

    switch (op) {
      case 'enqueue':
        result = _enqueue(value);
        break;
      case 'dequeue':
        result = _dequeue();
        break;
      case 'peek':
        result = _peek();
        break;
      case 'search':
        result = _search(value);
        break;
    }

    if (result.steps.length > 0) {
      buffer = result.buffer;
      count = result.count;
      head = result.head;
      Animator.load(result.steps);
    }
  });

  function _nextCapacity(size) {
    let next = 4;
    while (next < size && next < MAX_CAPACITY) next *= 2;
    return Math.min(next, MAX_CAPACITY);
  }

  function _physicalIdx(logicalIndex, headValue = head, cap = capacity) {
    return (headValue + logicalIndex) % cap;
  }

  function _rearIdx(countValue = count, headValue = head) {
    if (countValue === 0) return null;
    return _physicalIdx(countValue - 1, headValue);
  }

  function _nextInsertIdx(countValue = count, headValue = head) {
    return _physicalIdx(countValue, headValue);
  }

  function _slotId(idx) {
    return `slot-${idx}`;
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
        note: `Slot físico ${idx} ainda está na cache line ${line}.`,
      };
    }
    return {
      event: 'miss',
      cycles: 200,
      note: `Cache line ${line} ainda não estava carregada; acesso contíguo ao ring buffer.`,
    };
  }

  function _buildMemory(bufferState, accessedIdx, noteOverride = null) {
    const cache = (accessedIdx != null && accessedIdx >= 0)
      ? _cacheFor(accessedIdx)
      : { event: null, cycles: null, note: null };

    return {
      type: 'circular-queue',
      totalBytes: capacity * BYTES_PER_ELEM,
      event: cache.event,
      cycles: cache.cycles,
      note: noteOverride || cache.note || `Buffer circular de ${capacity} slots.`,
      accessedIdx: accessedIdx != null ? accessedIdx : null,
      layout: bufferState.map((value, idx) => ({
        value: value == null ? '·' : value,
        addr: _addr(idx),
      })),
    };
  }

  function _snapshot(bufferState, countState, headState, highlightedIdxs = [], hlState = 'visiting') {
    const nodes = bufferState.map((value, idx) => ({
      id: _slotId(idx),
      value: value == null ? '·' : value,
      state: highlightedIdxs.includes(idx) ? hlState : 'neutral',
    }));

    const pointers = {};
    if (countState > 0) {
      pointers.front = _slotId(headState);
      pointers.rear = _slotId(_rearIdx(countState, headState));
    }

    return {
      type: 'circular-queue',
      nodes,
      pointers,
    };
  }

  function _enqueue(val) {
    if (isNaN(val)) {
      alert('Informe um valor.');
      return { steps: [], buffer, count, head };
    }
    if (count >= capacity) {
      alert(`A fila circular está cheia (${capacity} slots).`);
      return { steps: [], buffer, count, head };
    }

    const nextBuffer = buffer.slice();
    const insertIdx = _nextInsertIdx();
    nextBuffer[insertIdx] = val;
    const wrapped = count > 0 && insertIdx < head;
    const nextCount = count + 1;
    const steps = [];

    steps.push({
      description: `Enqueue ${val}: calculando a próxima posição livre no ring buffer. rear atual ocupa o slot ${_rearIdx() ?? '—'} e a escrita ocorrerá no slot ${insertIdx}.`,
      snapshot: _snapshot(buffer, count, head, count > 0 ? [_rearIdx()] : [], 'visiting'),
      memory: _buildMemory(buffer, count > 0 ? _rearIdx() : null),
    });

    steps.push({
      description: wrapped
        ? `Passo 2/3: o fim físico do buffer foi alcançado; rear dá wrap e volta ao slot ${insertIdx}. Nenhum elemento precisa ser deslocado.`
        : `Passo 2/3: gravando ${val} diretamente no slot ${insertIdx} do buffer contíguo.`,
      snapshot: _snapshot(nextBuffer, count, head, [insertIdx], 'warning'),
      memory: _buildMemory(nextBuffer, insertIdx),
    });

    steps.push({
      description: `Passo 3/3: rear atualizado para o slot ${insertIdx}. Enqueue concluído com ocupação ${nextCount}/${capacity} — O(1).`,
      snapshot: _snapshot(nextBuffer, nextCount, head, [insertIdx], 'success'),
      memory: _buildMemory(nextBuffer, null, `Ocupação atual ${nextCount}/${capacity}; front permanece no slot ${head}.`),
    });

    return { steps, buffer: nextBuffer, count: nextCount, head };
  }

  function _dequeue() {
    if (count === 0) {
      alert('Fila circular vazia.');
      return { steps: [], buffer, count, head };
    }

    const removeIdx = head;
    const removed = buffer[removeIdx];
    const nextBuffer = buffer.slice();
    nextBuffer[removeIdx] = null;
    const nextCount = count - 1;
    const nextHead = nextCount === 0 ? 0 : (head + 1) % capacity;
    const wrapped = nextCount > 0 && nextHead < head;
    const steps = [];

    steps.push({
      description: `Dequeue: removendo o valor ${removed} do front no slot ${removeIdx}.`,
      snapshot: _snapshot(buffer, count, head, [removeIdx], 'danger'),
      memory: _buildMemory(buffer, removeIdx),
    });

    steps.push({
      description: nextCount === 0
        ? 'Passo 2/2: a fila ficou vazia; front e rear deixam de apontar para slots válidos.'
        : wrapped
          ? `Passo 2/2: front avança com wrap para o slot ${nextHead}. Dequeue concluído — O(1).`
          : `Passo 2/2: front avança para o slot ${nextHead}. Dequeue concluído — O(1).`,
      snapshot: _snapshot(nextBuffer, nextCount, nextHead, nextCount > 0 ? [nextHead] : [], 'success'),
      memory: _buildMemory(nextBuffer, nextCount > 0 ? nextHead : null, `Ocupação atual ${nextCount}/${capacity}.`),
    });

    return { steps, buffer: nextBuffer, count: nextCount, head: nextHead };
  }

  function _peek() {
    const frontIdx = head;
    const steps = [{
      description: `Peek: consultando o front sem remover. O valor está no slot ${frontIdx}.`,
      snapshot: _snapshot(buffer, count, head, [frontIdx], 'visiting'),
      memory: _buildMemory(buffer, frontIdx),
    }, {
      description: `Passo 2/2: front contém ${buffer[frontIdx]}. A fila circular não foi modificada — O(1).`,
      snapshot: _snapshot(buffer, count, head, [frontIdx], 'success'),
      memory: _buildMemory(buffer, frontIdx),
    }];

    return { steps, buffer: buffer.slice(), count, head };
  }

  function _search(val) {
    if (isNaN(val)) {
      alert('Informe um valor.');
      return { steps: [], buffer, count, head };
    }

    const steps = [{
      description: `Busca pelo valor ${val}. A travessia segue a ordem lógica da fila, começando em front e aplicando wrap quando necessário.`,
      snapshot: _snapshot(buffer, count, head),
      memory: _buildMemory(buffer, null),
    }];

    for (let logical = 0; logical < count; logical++) {
      const idx = _physicalIdx(logical);
      const found = buffer[idx] === val;
      steps.push({
        description: `Passo ${logical + 1}/${count}: posição lógica ${logical} corresponde ao slot físico ${idx}, com valor ${buffer[idx]}. ${found ? 'ENCONTRADO!' : 'Continuar.'}`,
        snapshot: _snapshot(buffer, count, head, [idx], found ? 'success' : 'visiting'),
        memory: _buildMemory(buffer, idx),
      });
      if (found) {
        return { steps, buffer: buffer.slice(), count, head };
      }
    }

    steps.push({
      description: `Valor ${val} não encontrado na fila circular.`,
      snapshot: _snapshot(buffer, count, head),
      memory: _buildMemory(buffer, null),
    });
    return { steps, buffer: buffer.slice(), count, head };
  }
}
