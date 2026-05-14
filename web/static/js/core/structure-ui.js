/**
 * structure-ui.js — Utilitários de UI compartilhados por todas as páginas de estrutura.
 *
 * Expõe o objeto global `StructureUI` com funções para:
 *  - Sincronizar campos dinâmicos do formulário de operações
 *  - Renderizar a tabela de complexidade Big-O
 *  - Renderizar as listas "Quando usar"
 *  - Renderizar os snippets de código com troca de abas
 *  - Inicializar todos os metadados de uma vez (initMeta)
 *
 * Cada arquivo de estrutura (array.js, singly.js, etc.) delega essas
 * responsabilidades aqui, eliminando ~150 linhas de código duplicado.
 */

const StructureUI = (() => {

  // ── HTML escaping ─────────────────────────────────────────────────────────

  /**
   * Escapa &, <, >, ", ' para entidades HTML.
   * Usada para inserir texto do JSON com segurança via innerHTML.
   * @param {string} str
   * @returns {string}
   */
  function _escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // ── Mapa de campos por operação ──────────────────────────────────────────
  // Idêntico em todas as estruturas lineares — pode ser sobrescrito localmente
  // se uma estrutura tiver operações diferentes (ex: Stack com push/pop).
  const DEFAULT_FIELD_MAP = {
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

  /**
   * Exibe ou oculta os campos do formulário conforme a operação selecionada.
   * @param {HTMLSelectElement} selectOp
   * @param {HTMLElement}       fieldValue
   * @param {HTMLElement}       fieldIndex
   * @param {HTMLElement}       fieldNewVal
   * @param {object}            [fieldMap]   - sobrescreve DEFAULT_FIELD_MAP se fornecido
   */
  function syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, fieldMap) {
    const map    = fieldMap || DEFAULT_FIELD_MAP;
    const fields = map[selectOp.value] || [];
    fieldValue.style.display  = fields.includes('value')    ? 'flex' : 'none';
    fieldIndex.style.display  = fields.includes('index')    ? 'flex' : 'none';
    fieldNewVal.style.display = fields.includes('newValue') ? 'flex' : 'none';
  }

  // ── Tabela de complexidade ────────────────────────────────────────────────

  /**
   * Preenche a tabela Big-O a partir do objeto `complexity` do JSON da estrutura.
   * @param {object} c - meta.complexity
   */
  function populateComplexity(c) {
    if (!c) return;
    const tbody = document.getElementById('complexity-body');
    if (!tbody) return;

    const rows = [
      ['Acesso',          c.access],
      ['Busca',           c.search],
      ['Inserção início', c.insertBegin],
      ['Inserção fim',    c.insertEnd],
      ['Inserção meio',   c.insertMiddle],
      ['Remoção',         c.delete],
    ];

    tbody.innerHTML = rows
      .filter(([, obj]) => obj)
      .map(([name, obj]) => `
        <tr>
          <td>${_escapeHtml(name)}</td>
          <td>${_escapeHtml(obj.best)}</td>
          <td>${_escapeHtml(obj.average)}</td>
          <td>${_escapeHtml(obj.worst)}</td>
        </tr>`)
      .join('');

    const spaceEl = document.getElementById('space-complexity');
    if (spaceEl && c.space) spaceEl.textContent = c.space;
  }

  // ── Listas "Quando usar" ──────────────────────────────────────────────────

  /**
   * Preenche as listas de casos de uso a partir do objeto `useCases` do JSON.
   * @param {object} u - meta.useCases
   */
  function populateUseCases(u) {
    if (!u) return;
    const fill = (id, items) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = (items || []).map(t => `<li>${_escapeHtml(t)}</li>`).join('');
    };
    fill('list-recommended',     u.recommended);
    fill('list-not-recommended', u.notRecommended);
    fill('list-examples',        u.realWorldExamples);
  }

  // ── Snippets de código ────────────────────────────────────────────────────

  /**
   * Inicializa as abas de snippets de código.
   * @param {object} snippets - meta.codeSnippets  { csharp, go, python, javascript }
   */
  function populateSnippets(snippets) {
    if (!snippets) return;
    const tabs   = document.querySelectorAll('.tab-btn');
    const codeEl = document.getElementById('code-content');
    if (!codeEl) return;

    let activeLang = 'csharp';

    function _show(lang) {
      activeLang = lang;
      codeEl.textContent = snippets[lang] || '// Snippet não disponível';
      tabs.forEach(t => t.classList.toggle('tab-btn--active', t.dataset.lang === lang));
    }

    tabs.forEach(t => t.addEventListener('click', () => _show(t.dataset.lang)));
    _show(activeLang);
  }

  // ── Inicializador de metadados ────────────────────────────────────────────

  /**
   * Inicializa todos os metadados da página de estrutura de uma vez.
   * Substitui o bloco de 3 chamadas repetido em todos os arquivos de estrutura.
   *
   * @param {object} meta         - window.__STRUCTURE_DATA__
   * @param {string} fallbackName - nome exibido caso meta.name esteja ausente
   */
  function initMeta(meta, fallbackName) {
    if (!meta) return;
    const breadcrumb = document.getElementById('struct-name-breadcrumb');
    if (breadcrumb) breadcrumb.textContent = meta.name || fallbackName;
    document.title = `[ds-explorer] — ${meta.name || fallbackName}`;
    populateComplexity(meta.complexity);
    populateUseCases(meta.useCases);
    populateSnippets(meta.codeSnippets);
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  /**
   * Inicializa todos os elementos de UI de uma página de estrutura de uma vez,
   * eliminando o bloco de ~15 linhas de boilerplate de cada arquivo de estrutura.
   *
   * @param {object}  [opts]
   * @param {string}  [opts.fallbackName]  - Nome exibido se meta.name estiver ausente
   * @param {string}  [opts.memoryType]    - Tipo passado para MemoryPanel.init()
   * @param {object}  [opts.fieldMap]      - Sobrescreve DEFAULT_FIELD_MAP
   * @param {number}  [opts.maxSize]       - Seta inputSize.max (omitir = usar HTML)
   * @param {string}  [opts.selectHtml]    - innerHTML do select-operation (omitir = manter)
   * @returns {{ meta, selectOp, inputSize, btnGenerate, btnExecute,
   *             fieldValue, fieldIndex, fieldNewVal, inputValue, inputIndex, inputNewVal }}
   */
  function bootstrap({ fallbackName, memoryType, fieldMap, maxSize, selectHtml } = {}) {
    const meta        = window.__STRUCTURE_DATA__;
    const selectOp    = document.getElementById('select-operation');
    const inputSize   = document.getElementById('input-size');
    const btnGenerate = document.getElementById('btn-generate');
    const btnExecute  = document.getElementById('btn-execute');
    const fieldValue  = document.getElementById('field-value');
    const fieldIndex  = document.getElementById('field-index');
    const fieldNewVal = document.getElementById('field-new-value');
    const inputValue  = document.getElementById('input-value');
    const inputIndex  = document.getElementById('input-index');
    const inputNewVal = document.getElementById('input-new-value');

    if (maxSize   != null) inputSize.max       = String(maxSize);
    if (selectHtml != null) selectOp.innerHTML = selectHtml;

    const map = fieldMap || DEFAULT_FIELD_MAP;
    function _sync() { syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, map); }
    selectOp.addEventListener('change', _sync);
    _sync();

    initMeta(meta, fallbackName);
    if (memoryType) MemoryPanel.init(memoryType);

    return { meta, selectOp, inputSize, btnGenerate, btnExecute,
             fieldValue, fieldIndex, fieldNewVal, inputValue, inputIndex, inputNewVal };
  }

  // ── API pública ───────────────────────────────────────────────────────────

  return {
    DEFAULT_FIELD_MAP,
    syncFields,
    populateComplexity,
    populateUseCases,
    populateSnippets,
    initMeta,
    bootstrap,
  };
})();
