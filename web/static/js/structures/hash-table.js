/**
 * hash-table.js - tabela hash com enderecamento aberto e linear probing.
 */
function initStructurePage() {
  let table = [];
  let count = 0;
  let capacity = 11;
  const MAX_CAPACITY = 23;
  const BYTES_PER_BUCKET = 8;
  const TOMBSTONE = '#';

  // ── UI ────────────────────────────────────────────────────────────────
  const { selectOp, inputSize, btnGenerate, btnExecute, inputValue } = StructureUI.bootstrap({
    fallbackName: 'Tabela Hash',
    memoryType:   'hash-table',
    maxSize:      14,
    fieldMap:     { insert: ['value'], search: ['value'], remove: ['value'] },
    selectHtml: `
      <optgroup label="Tabela Hash">
        <option value="insert">Inserir chave</option>
        <option value="search">Buscar chave</option>
        <option value="remove">Remover chave</option>
      </optgroup>
    `,
  });

  // ── Memory ────────────────────────────────────────────────────────────
  const _mem = MemoryHelpers.forArray({ type: 'hash-table', bytesPerElem: 8, elemsPerLine: 8, baseAddr: 0x9000 });

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(14, Math.max(2, parseInt(inputSize.value, 10) || 6));
    capacity = _nextPrime(Math.min(MAX_CAPACITY, Math.max(11, size * 2)));
    table = Array(capacity).fill(null);
    count = 0;
    while (count < size) _insertRaw(Math.floor(Math.random() * 90) + 1);
    _mem.reset();
    Animator.load([{
      description: `Tabela hash gerada com ${count} chaves e ${capacity} buckets. Hash usado: chave mod ${capacity}.`,
      snapshot: _snapshot(table),
      memory: _buildMemory(table, null),
    }]);
  });
  btnGenerate.click();

  btnExecute.addEventListener('click', () => {
    const value = parseInt(inputValue.value, 10);
    if (isNaN(value)) { alert('Informe uma chave numerica.'); return; }
    _mem.reset();
    let result = { steps: [] };
    switch (selectOp.value) {
      case 'insert': result = _insert(value); break;
      case 'search': result = _search(value); break;
      case 'remove': result = _remove(value); break;
    }
    if (result.steps.length > 0) {
      table = result.table;
      count = table.filter(v => v != null && v !== TOMBSTONE).length;
      Animator.load(result.steps);
    }
  });

  function _hash(value) { return Math.abs(value) % capacity; }
  function _nextPrime(n) {
    function isPrime(x) {
      for (let d = 2; d * d <= x; d++) if (x % d === 0) return false;
      return true;
    }
    while (!isPrime(n)) n++;
    return n;
  }

  function _insertRaw(value) {
    for (let i = 0; i < capacity; i++) {
      const idx = (_hash(value) + i) % capacity;
      if (table[idx] == null || table[idx] === TOMBSTONE || table[idx] === value) {
        if (table[idx] !== value) count++;
        table[idx] = value;
        return;
      }
    }
  }

  function _buildMemory(state, accessedIdx, note = null) {
    const result = _mem.buildMemory(state, accessedIdx, note || undefined);
    result.totalBytes = capacity * BYTES_PER_BUCKET;
    result.note       = result.note || `Carga ${count}/${capacity}; buckets vazios sao exibidos como ponto.`;
    result.layout     = state.map((v, i) => ({ value: _label(v), addr: _mem.addr(i) }));
    return result;
  }

  function _insert(value) {
    if ((count + 1) / capacity > 0.7) {
      alert('Carga acima de 70%. Gere uma tabela maior para continuar a demonstracao.');
      return { steps: [], table };
    }

    const next = table.slice();
    const start = _hash(value);
    const steps = [{
      description: `Inserir ${value}: hash(${value}) = ${start}. A sondagem linear comeca nesse bucket.`,
      snapshot: _snapshot(next, [start], 'visiting'),
      memory: _buildMemory(next, start),
    }];

    for (let probe = 0; probe < capacity; probe++) {
      const idx = (start + probe) % capacity;
      const current = next[idx];
      const free = current == null || current === TOMBSTONE;
      steps.push({
        description: `Probe ${probe + 1}: bucket ${idx} contem ${_label(current)}. ${free ? 'Livre para inserir.' : current === value ? 'Chave ja existe.' : 'Colisao; avancar.'}`,
        snapshot: _snapshot(next, [idx], free ? 'success' : current === value ? 'success' : 'warning'),
        memory: _buildMemory(next, idx),
      });
      if (current === value) return { steps, table: next };
      if (free) {
        next[idx] = value;
        steps.push({
          description: `Chave ${value} gravada no bucket ${idx}. Insercao media O(1), pior caso O(n).`,
          snapshot: _snapshot(next, [idx], 'success'),
          memory: _buildMemory(next, idx),
        });
        return { steps, table: next };
      }
    }
    return { steps, table: next };
  }

  function _search(value) {
    const start = _hash(value);
    const steps = [{
      description: `Buscar ${value}: hash(${value}) = ${start}. Paramos ao achar a chave ou um bucket vazio.`,
      snapshot: _snapshot(table, [start], 'visiting'),
      memory: _buildMemory(table, start),
    }];
    for (let probe = 0; probe < capacity; probe++) {
      const idx = (start + probe) % capacity;
      const current = table[idx];
      const found = current === value;
      steps.push({
        description: `Probe ${probe + 1}: bucket ${idx} contem ${_label(current)}. ${found ? 'ENCONTRADO!' : current == null ? 'Bucket vazio; chave nao existe.' : 'Continuar sondagem.'}`,
        snapshot: _snapshot(table, [idx], found ? 'success' : current == null ? 'danger' : 'visiting'),
        memory: _buildMemory(table, idx),
      });
      if (found || current == null) return { steps, table: table.slice() };
    }
    return { steps, table: table.slice() };
  }

  function _remove(value) {
    const start = _hash(value);
    const next = table.slice();
    const steps = [{
      description: `Remover ${value}: local inicial e bucket ${start}. Tombstone preserva a cadeia de probing.`,
      snapshot: _snapshot(next, [start], 'visiting'),
      memory: _buildMemory(next, start),
    }];
    for (let probe = 0; probe < capacity; probe++) {
      const idx = (start + probe) % capacity;
      const current = next[idx];
      const found = current === value;
      steps.push({
        description: `Probe ${probe + 1}: bucket ${idx} contem ${_label(current)}. ${found ? 'Chave encontrada para remocao.' : current == null ? 'Bucket vazio; parar.' : 'Continuar.'}`,
        snapshot: _snapshot(next, [idx], found ? 'danger' : current == null ? 'danger' : 'visiting'),
        memory: _buildMemory(next, idx),
      });
      if (found) {
        next[idx] = TOMBSTONE;
        steps.push({
          description: `Bucket ${idx} marcado como tombstone para nao quebrar buscas futuras.`,
          snapshot: _snapshot(next, [idx], 'warning'),
          memory: _buildMemory(next, idx),
        });
        return { steps, table: next };
      }
      if (current == null) return { steps, table: next };
    }
    return { steps, table: next };
  }

  function _label(value) {
    if (value == null) return '.';
    if (value === TOMBSTONE) return 'x';
    return value;
  }

  function _snapshot(state, highlighted = [], hlState = 'visiting') {
    return {
      type: 'array',
      nodes: state.map((value, i) => ({ id: i, value: _label(value), state: highlighted.includes(i) ? hlState : 'neutral' })),
    };
  }
}
