/**
 * memory-panel.js
 * Exibe informações de memória simuladas para cada step da animação.
 *
 * API pública:
 *   MemoryPanel.init(type)       — configura o painel para a estrutura atual
 *   MemoryPanel.update(memory)   — atualiza os dados do step corrente
 *
 * O objeto `memory` em cada step tem o formato:
 * {
 *   type:        'array' | 'singly' | 'doubly',
 *   totalBytes:  number,
 *   event:       null | 'hit' | 'miss',
 *   cycles:      null | 4 | 200,
 *   note:        string,
 *   accessedIdx: null | number,   // índice no layout que está destacado
 *   layout:      [{ value, addr }]
 * }
 */
const MemoryPanel = (() => {

  // Constantes reais de hardware (simuladas didaticamente)
  const CACHE_LINE_BYTES = 64;

  const CONFIGS = {
    array: {
      bytesPerElem: 4,          // int32 = 4 bytes
      allocType:   'Estática contígua',
      elemLabel:   'Por elemento',
      cacheLineElems: 16,       // 64B / 4B = 16 ints por cache line
      baseAddr: 0x1000,
      fragmented: false,
    },
    singly: {
      bytesPerElem: 16,         // value(4) + next ptr(8) + padding(4) = 16B
      allocType:   'Dinâmica (heap)',
      elemLabel:   'Por nó',
      cacheLineElems: 4,        // 64B / 16B = 4 nós por cache line
      baseAddr: 0x2000,
      fragmented: true,
    },
    doubly: {
      bytesPerElem: 24,         // value(4) + next(8) + prev(8) + padding(4) = 24B
      allocType:   'Dinâmica (heap)',
      elemLabel:   'Por nó',
      cacheLineElems: 2,        // floor(64B / 24B) = 2 nós por cache line
      baseAddr: 0x2000,
      fragmented: true,
    },
  };

  let _cfg = null;

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const el = id => document.getElementById(id);

  // ── init ──────────────────────────────────────────────────────────────────

  function init(type) {
    _cfg = CONFIGS[type] || CONFIGS.array;

    _set('mem-alloc-type',  _cfg.allocType);
    _set('mem-elem-label',  _cfg.elemLabel);
    _set('mem-bytes-elem',  `${_cfg.bytesPerElem} B`);
    _set('mem-cache-line',  `${CACHE_LINE_BYTES} B  (${_cfg.cacheLineElems} elem.)`);
    _set('mem-total',       '—');
    _set('mem-cycles',      '—');
    _set('mem-note',        '');

    const ce = el('mem-cache-event');
    if (ce) { ce.textContent = '—'; ce.className = 'mem-badge'; }

    const blocks = el('mem-layout-blocks');
    if (blocks) blocks.innerHTML = '';
  }

  // ── update ────────────────────────────────────────────────────────────────

  function update(memory) {
    if (!memory) {
      _resetAccess();
      return;
    }

    // Total alocado
    _set('mem-total', `${memory.totalBytes} B`);

    // Cache event badge
    const ce = el('mem-cache-event');
    if (ce) {
      if (memory.event === 'hit') {
        ce.textContent = 'HIT';
        ce.className   = 'mem-badge mem-badge--hit';
      } else if (memory.event === 'miss') {
        ce.textContent = 'MISS';
        ce.className   = 'mem-badge mem-badge--miss';
      } else {
        ce.textContent = '—';
        ce.className   = 'mem-badge';
      }
    }

    // Ciclos
    _set('mem-cycles', memory.cycles != null ? `~${memory.cycles}` : '—');

    // Nota explicativa
    _set('mem-note', memory.note || '');

    // Layout visual
    if (memory.layout) _renderLayout(memory.layout, memory.accessedIdx, memory.type);
  }

  // ── layout visual ─────────────────────────────────────────────────────────

  function _renderLayout(layout, activeIdx, type) {
    const container = el('mem-layout-blocks');
    if (!container || !_cfg) return;
    container.innerHTML = '';

    layout.forEach((block, i) => {
      // Separador de cache line para arrays
      if (!_cfg.fragmented && i > 0 && i % _cfg.cacheLineElems === 0) {
        const sep = document.createElement('div');
        sep.className = 'mem-line-sep';
        sep.title     = `Início da cache line ${Math.floor(i / _cfg.cacheLineElems)}`;
        container.appendChild(sep);
      }

      const wrap = document.createElement('div');
      wrap.className = 'mem-block-wrap';

      const cell = document.createElement('div');
      cell.className = 'mem-block' + (i === activeIdx ? ' mem-block--active' : '');
      cell.textContent = block.value ?? '?';

      const addr = document.createElement('div');
      addr.className = 'mem-block-addr';
      addr.textContent = block.addr;

      wrap.appendChild(cell);
      wrap.appendChild(addr);
      container.appendChild(wrap);

      // Indicador de fragmentação entre nós de lista encadeada
      if (_cfg.fragmented && i < layout.length - 1) {
        const gap = document.createElement('div');
        gap.className = 'mem-gap';
        gap.title     = 'Endereços não contíguos — cada nó alocado independentemente no heap';
        gap.textContent = '···';
        container.appendChild(gap);
      }
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  function _set(id, text) {
    const node = el(id);
    if (node) node.textContent = text;
  }

  function _resetAccess() {
    const ce = el('mem-cache-event');
    if (ce) { ce.textContent = '—'; ce.className = 'mem-badge'; }
    _set('mem-cycles', '—');
    _set('mem-note',   '');
  }

  return { init, update };
})();
