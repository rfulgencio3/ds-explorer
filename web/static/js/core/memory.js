/**
 * memory.js — Fábricas de simulação de memória para estruturas de dados.
 *
 * Expõe o objeto global `MemoryHelpers` com duas fábricas:
 *  - forArray:  para estruturas contíguas (array, heap, hash-table, etc.)
 *  - forLinked: para estruturas encadeadas (listas, árvores, etc.)
 *
 * Cada fábrica retorna { addr/nodeAddr, buildMemory, reset }.
 * Os arquivos de estrutura usam essas fábricas para eliminar a duplicação
 * de _nodeAddr + _cacheFor + _buildMemory em cada arquivo.
 */

const MemoryHelpers = (() => {

  /**
   * Fábrica para estruturas de alocação contígua (array, heap, hash-table…).
   *
   * @param {object} cfg
   * @param {string} cfg.type         - Tipo de memória ('array', 'heap', …)
   * @param {number} cfg.bytesPerElem - Bytes por elemento
   * @param {number} cfg.elemsPerLine - Elementos por cache line (64B / bytesPerElem)
   * @param {number} cfg.baseAddr     - Endereço base simulado
   * @param {string} [cfg.idleNote]   - Nota exibida quando não há acesso específico
   * @returns {{ addr, buildMemory, reset }}
   */
  function forArray({ type, bytesPerElem, elemsPerLine, baseAddr, idleNote = null }) {
    let _line = -1;

    function addr(i) {
      const hex = (baseAddr + i * bytesPerElem).toString(16).toUpperCase();
      return '0x' + hex.padStart(4, '0');
    }

    function _cache(idx) {
      const line = Math.floor(idx / elemsPerLine);
      const hit  = line === _line;
      _line = line;
      if (hit) {
        return { event: 'hit',  cycles: 4,   note: `Posição ${idx} na cache line ${line} — já no L1.` };
      }
      return { event: 'miss', cycles: 200, note: `Cache line ${line} não estava carregada — busca na RAM (~200 ciclos).` };
    }

    /**
     * Constrói o objeto memory para um step.
     * @param {any[]}   items        - Elementos da estrutura
     * @param {number}  accessedIdx  - Índice acessado (null = sem acesso)
     * @param {string}  [noteOverride] - Substitui a nota calculada
     */
    function buildMemory(items, accessedIdx, noteOverride = null) {
      const valid = accessedIdx != null && accessedIdx >= 0 && accessedIdx < items.length;
      const cache = valid ? _cache(accessedIdx) : { event: null, cycles: null, note: idleNote };
      return {
        type,
        totalBytes:  items.length * bytesPerElem,
        event:       cache.event,
        cycles:      cache.cycles,
        note:        noteOverride != null ? noteOverride : cache.note,
        accessedIdx: valid ? accessedIdx : null,
        layout:      items.map((v, i) => ({ value: v, addr: addr(i) })),
      };
    }

    function reset() { _line = -1; }

    return { addr, buildMemory, reset };
  }

  /**
   * Fábrica para estruturas encadeadas (listas, pilhas, filas, árvores…).
   *
   * Usa hash multiplicativo de Knuth para gerar endereços simulados dispersos,
   * simulando a fragmentação de heap que causa cache misses frequentes.
   *
   * @param {object}   cfg
   * @param {string}   cfg.type         - Tipo de memória ('singly', 'tree', …)
   * @param {number}   cfg.bytesPerNode - Bytes por nó
   * @param {number}   cfg.baseAddr     - Endereço base simulado
   * @param {number}   cfg.hashMult     - Multiplicador do hash (ex: 2654435761)
   * @param {number}   cfg.rangeSize    - Amplitude do hash (ex: 0x4000)
   * @param {number}   cfg.alignMask    - Máscara de alinhamento (ex: ~0xF)
   * @param {string}   [cfg.idleNote]   - Nota exibida sem acesso específico
   * @param {Function} [cfg.missNote]   - (addr: string) => string para miss
   * @returns {{ nodeAddr, buildMemory, reset }}
   */
  function forLinked({ type, bytesPerNode, baseAddr, hashMult, rangeSize, alignMask,
                        idleNote = null, missNote = null }) {
    let _prevId = -1;

    function nodeAddr(id) {
      const offset = ((id * hashMult) >>> 0) % rangeSize;
      const hex    = (baseAddr + (offset & alignMask)).toString(16).toUpperCase();
      return '0x' + hex.padStart(4, '0');
    }

    function _cache(id) {
      const hit = id === _prevId;
      _prevId = id;
      if (hit) {
        return { event: 'hit', cycles: 4, note: 'Nó ainda presente no cache L1 — acesso recente.' };
      }
      const a = nodeAddr(id);
      return {
        event:  'miss',
        cycles: 200,
        note:   missNote ? missNote(a) : `Ponteiro aponta para ${a} — endereço não contíguo, busca na RAM.`,
      };
    }

    /**
     * Constrói o objeto memory para um step.
     * @param {Array<{id,value}>} items      - Lista plana de nós
     * @param {number}            accessedId - id do nó acessado (null = sem acesso)
     * @param {string}            [noteOverride] - Substitui a nota calculada
     */
    function buildMemory(items, accessedId, noteOverride = null) {
      const hasAccess = accessedId != null && accessedId >= 0;
      const cache     = hasAccess ? _cache(accessedId) : { event: null, cycles: null, note: idleNote };
      const idx       = hasAccess ? items.findIndex(n => n.id === accessedId) : -1;
      return {
        type,
        totalBytes:  items.length * bytesPerNode,
        event:       cache.event,
        cycles:      cache.cycles,
        note:        noteOverride != null ? noteOverride : cache.note,
        accessedIdx: idx >= 0 ? idx : null,
        layout:      items.map(n => ({ value: n.value, addr: nodeAddr(n.id) })),
      };
    }

    function reset() { _prevId = -1; }

    return { nodeAddr, buildMemory, reset };
  }

  return { forArray, forLinked };
})();
