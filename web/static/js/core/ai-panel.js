/**
 * ai-panel.js — Widget flutuante "Ada IA" para páginas de estrutura de dados.
 *
 * Ada IA é uma assistente educacional descontraída, criada em homenagem a
 * Ada Lovelace — a primeira programadora da história.
 *
 * API pública:
 *   AiPanel.init(structureId)  — inicializa o widget para a estrutura atual
 *
 * Comunica com o backend via POST /api/ai/ask.
 * A API key Gemini fica exclusivamente no servidor — nunca exposta ao browser.
 */

const AiPanel = (() => {

  // ── Estado privado ──────────────────────────────────────────────────────
  let _structureId = '';
  let _loading     = false;
  let _open        = false;

  // ── Refs DOM (resolvidas em init) ───────────────────────────────────────
  let _floatBtn   = null;
  let _floatPanel = null;
  let _closeBtn   = null;
  let _textarea   = null;
  let _btnSend    = null;
  let _answer     = null;
  let _status     = null;

  // ── Helpers privados ────────────────────────────────────────────────────

  // Cópia local — não cria dependência cruzada com StructureUI (ver CLAUDE.md §5)
  function _escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function _openPanel() {
    _open = true;
    _floatPanel.classList.add('ada-float-panel--open');
    _floatPanel.setAttribute('aria-hidden', 'false');
    _textarea.focus();
  }

  function _closePanel() {
    _open = false;
    _floatPanel.classList.remove('ada-float-panel--open');
    _floatPanel.setAttribute('aria-hidden', 'true');
  }

  function _togglePanel() {
    _open ? _closePanel() : _openPanel();
  }

  function _setLoading(on) {
    _loading          = on;
    _btnSend.disabled = on;
    _btnSend.textContent = on ? 'Aguardando Ada...' : 'Enviar';
    if (on) {
      _answer.textContent = '';
      _status.textContent = '';
      _status.className   = 'ada-panel-status';
    }
  }

  function _showError(msg, cls) {
    _status.className   = 'ada-panel-status ' + (cls || 'ada-panel-status--error');
    _status.textContent = msg;
    _answer.textContent = '';
  }

  function _showAnswer(text) {
    _status.textContent = '';
    _status.className   = 'ada-panel-status';
    // Escapa todo o conteúdo; preserva quebras de linha da resposta do Gemini
    _answer.innerHTML = _escapeHtml(text).replace(/\n/g, '<br>');
  }

  async function _send() {
    if (_loading) return;

    const question = _textarea.value.trim();
    if (!question) {
      _showError('Digite uma pergunta antes de enviar.');
      return;
    }
    if (question.length > 512) {
      _showError('Pergunta muito longa (máximo 512 caracteres).');
      return;
    }

    _setLoading(true);

    try {
      const resp = await fetch('/api/ai/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question, structureId: _structureId }),
      });

      const data = await resp.json();

      if (resp.status === 429) {
        _showError(data.error || 'Aguarde 1 minuto entre perguntas.', 'ada-panel-status--rate');
      } else if (!resp.ok || data.error) {
        _showError(data.error || 'Erro ao consultar a Ada IA. Tente novamente.');
      } else {
        _showAnswer(data.answer);
      }
    } catch (_) {
      _showError('Falha de conexão. Verifique sua rede e tente novamente.');
    } finally {
      _setLoading(false);
    }
  }

  // ── API pública ─────────────────────────────────────────────────────────

  /**
   * Inicializa o widget Ada IA para a estrutura indicada.
   * Deve ser chamado após o DOM estar pronto.
   * @param {string} structureId - id da estrutura (ex: "array")
   */
  function init(structureId) {
    _structureId = structureId;

    _floatBtn   = document.getElementById('ada-float-btn');
    _floatPanel = document.getElementById('ada-float-panel');
    _closeBtn   = document.getElementById('ada-float-close');
    _textarea   = document.getElementById('ada-question');
    _btnSend    = document.getElementById('ada-btn-send');
    _answer     = document.getElementById('ada-answer');
    _status     = document.getElementById('ada-status');

    if (!_floatBtn || !_floatPanel || !_textarea || !_btnSend || !_answer || !_status) {
      console.warn('[ds-explorer] AiPanel: elementos do DOM não encontrados');
      return;
    }

    _floatBtn.addEventListener('click', _togglePanel);
    _closeBtn.addEventListener('click', _closePanel);
    _btnSend.addEventListener('click', _send);

    // Ctrl+Enter / Cmd+Enter envia sem quebrar a linha
    _textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        _send();
      }
    });

    // Escape fecha o painel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _open) _closePanel();
    });
  }

  return { init };
})();
