/**
 * array.js — Lógica de simulação do Array Estático.
 *
 * Expõe initStructurePage() que é chamado após o carregamento do script.
 * Toda a simulação acontece no frontend; o Go não é consultado para as operações.
 */

function initStructurePage() {
  // ── State ──────────────────────────────────────────────────────────────
  let data = [];   // array de inteiros (estado atual)

  // ── Constantes de memória ──────────────────────────────────────────────
  // Array de int32: 4 bytes por elemento, alocação contígua.
  // Cache line = 64 bytes → 16 elementos int32 por cache line.
  const BYTES_PER_ELEM = 4;
  const ELEMS_PER_LINE = 16;   // 64 B / 4 B
  const BASE_ADDR      = 0x1000;

  // Rastreia a última cache line acessada para determinar hit/miss
  let _prevCacheLine = -1;

  // ── UI refs ────────────────────────────────────────────────────────────
  const meta         = window.__STRUCTURE_DATA__;
  const selectOp     = document.getElementById('select-operation');
  const inputSize    = document.getElementById('input-size');
  const btnGenerate  = document.getElementById('btn-generate');
  const btnExecute   = document.getElementById('btn-execute');
  const fieldValue   = document.getElementById('field-value');
  const fieldIndex   = document.getElementById('field-index');
  const fieldNewVal  = document.getElementById('field-new-value');
  const inputValue   = document.getElementById('input-value');
  const inputIndex   = document.getElementById('input-index');
  const inputNewVal  = document.getElementById('input-new-value');

  // ── Operation → which fields to show ──────────────────────────────────
  const fieldMap = {
    insertBegin:    ['value'],
    insertEnd:      ['value'],
    insertAt:       ['value', 'index'],
    removeBegin:    [],
    removeEnd:      [],
    removeAt:       ['index'],
    removeByValue:  ['value'],
    search:         ['value'],
    update:         ['index', 'newValue'],
  };

  function _syncFields() {
    const fields = fieldMap[selectOp.value] || [];
    fieldValue.style.display  = fields.includes('value')    ? 'flex' : 'none';
    fieldIndex.style.display  = fields.includes('index')    ? 'flex' : 'none';
    fieldNewVal.style.display = fields.includes('newValue') ? 'flex' : 'none';
  }
  selectOp.addEventListener('change', _syncFields);
  _syncFields();

  // ── Populate metadata ──────────────────────────────────────────────────
  if (meta) {
    document.getElementById('struct-name-breadcrumb').textContent = meta.name || 'Array';
    document.title = `[ds-explorer] — ${meta.name}`;
    _populateComplexity(meta.complexity);
    _populateUseCases(meta.useCases);
    _populateSnippets(meta.codeSnippets);
  }

  MemoryPanel.init('array');

  // ── Generate ───────────────────────────────────────────────────────────
  btnGenerate.addEventListener('click', () => {
    const size = Math.min(12, Math.max(2, parseInt(inputSize.value) || 6));
    data = Array.from({ length: size }, () => Math.floor(Math.random() * 90) + 1);
    _prevCacheLine = -1;
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
      const lastSnap = steps[steps.length - 1].snapshot;
      data = lastSnap.nodes.map(n => n.value);
    }

    Animator.load(steps);
  });

  // ── Memory helpers ─────────────────────────────────────────────────────

  /** Endereço simulado do elemento na posição i */
  function _addr(i) {
    const hex = (BASE_ADDR + i * BYTES_PER_ELEM).toString(16).toUpperCase();
    return '0x' + hex.padStart(4, '0');
  }

  /**
   * Calcula evento de cache ao acessar o índice `idx`.
   * Arrays têm localidade de referência: elementos consecutivos ficam
   * na mesma cache line (64B / 4B = 16 elementos).
   */
  function _cacheFor(idx) {
    const line = Math.floor(idx / ELEMS_PER_LINE);
    const hit  = line === _prevCacheLine;
    _prevCacheLine = line;
    if (hit) {
      return {
        event:  'hit',
        cycles: 4,
        note:   `Posição ${idx} está na cache line ${line} — já carregada no L1 (acesso sequencial)`,
      };
    }
    return {
      event:  'miss',
      cycles: 200,
      note:   `Cache line ${line} não estava carregada — busca na RAM (~200 ciclos)`,
    };
  }

  /**
   * Constrói o objeto `memory` para um step.
   * `accessedIdx` = índice do elemento acessado neste step (null se não houver acesso).
   */
  function _buildMemory(arr, accessedIdx) {
    const totalBytes = arr.length * BYTES_PER_ELEM;
    const cache = (accessedIdx != null && accessedIdx >= 0 && accessedIdx < arr.length)
      ? _cacheFor(accessedIdx)
      : { event: null, cycles: null, note: null };

    const layout = arr.map((v, i) => ({ value: v, addr: _addr(i) }));

    return {
      type:        'array',
      totalBytes,
      event:       cache.event,
      cycles:      cache.cycles,
      note:        cache.note,
      accessedIdx: (accessedIdx != null && accessedIdx >= 0) ? accessedIdx : null,
      layout,
    };
  }

  // ── Operations → steps ────────────────────────────────────────────────

  function _insertAt(arr, idx, val) {
    const steps = [];

    if (isNaN(val))  { alert('Informe um valor.'); return []; }
    if (isNaN(idx) || idx < 0 || idx > arr.length) { alert('Índice inválido.'); return []; }

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

  // ── Metadata renderers ─────────────────────────────────────────────────

  function _populateComplexity(c) {
    if (!c) return;
    const tbody = document.getElementById('complexity-body');
    const rows = [
      ['Acesso',          c.access],
      ['Busca',           c.search],
      ['Inserção início', c.insertBegin],
      ['Inserção fim',    c.insertEnd],
      ['Inserção meio',   c.insertMiddle],
      ['Remoção',         c.delete],
    ];
    tbody.innerHTML = rows.map(([name, obj]) => obj ? `
      <tr>
        <td>${name}</td>
        <td>${obj.best}</td>
        <td>${obj.average}</td>
        <td>${obj.worst}</td>
      </tr>` : '').join('');

    const spaceEl = document.getElementById('space-complexity');
    if (spaceEl && c.space) spaceEl.textContent = c.space;
  }

  function _populateUseCases(u) {
    if (!u) return;
    const fill = (id, items) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = (items || []).map(t => `<li>${t}</li>`).join('');
    };
    fill('list-recommended',     u.recommended);
    fill('list-not-recommended', u.notRecommended);
    fill('list-examples',        u.realWorldExamples);
  }

  function _populateSnippets(snippets) {
    if (!snippets) return;
    const tabs    = document.querySelectorAll('.tab-btn');
    const codeEl  = document.getElementById('code-content');
    let activeLang = 'csharp';

    function _showLang(lang) {
      activeLang = lang;
      codeEl.textContent = snippets[lang] || '// Snippet não disponível';
      tabs.forEach(t => t.classList.toggle('tab-btn--active', t.dataset.lang === lang));
    }

    tabs.forEach(t => t.addEventListener('click', () => _showLang(t.dataset.lang)));
    _showLang('csharp');
  }
}
