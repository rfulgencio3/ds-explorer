/**
 * animator.js
 * Controls step-by-step animation playback.
 *
 * Each structure's JS produces an array of "steps":
 * [
 *   {
 *     description: "Passo 1/5: ...",
 *     snapshot: { type, nodes, pointers }
 *   },
 *   ...
 * ]
 *
 * Animator receives these steps and exposes prev/next/play/restart controls.
 * It calls Renderer.draw(step.snapshot) on each step change.
 */

const Animator = (() => {
  let _steps   = [];
  let _current = -1;
  let _timer   = null;

  // Speed map: slider value -> ms per step
  const SPEEDS = { 1: 1200, 2: 650, 3: 300 };

  const btnPrev    = document.getElementById('btn-prev');
  const btnNext    = document.getElementById('btn-next');
  const btnPlay    = document.getElementById('btn-play');
  const btnRestart = document.getElementById('btn-restart');
  const sliderSpeed = document.getElementById('slider-speed');
  const speedLabel  = document.getElementById('speed-label');
  const stepLog     = document.getElementById('step-log');

  const SPEED_NAMES = { '1': 'Lento', '2': 'Médio', '3': 'Rápido' };

  function _updateSpeedLabel() {
    speedLabel.textContent = SPEED_NAMES[sliderSpeed.value] || 'Médio';
  }

  /**
   * Aplica syntax highlighting nas descrições dos passos.
   * Combina todos os padrões numa única regex para evitar double-replace.
   * Inspirado no tema Dark+ do VS Code.
   */
  function _hl(text) {
    // Escape text first so unmatched segments are safe in innerHTML.
    // Tokens matched by the regex below (digits, hex, keywords, arrows) never
    // contain &, < or > so no double-escaping occurs.
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(
      /(O\((?:log n|n|1)\)|0x[0-9A-Fa-f]+|\bHIT\b|\bMISS\b|ENCONTRADO!?|\bnullptr?\b|\b(?:head|HEAD|tail|TAIL|top|front|rear|next|prev|push|pop|peek|enqueue|dequeue)\b|↺|\b\d+\b|[→←])/gi,
      (m) => {
        if (/^O\(/.test(m)) return `<span class="hl-bigO">${m}</span>`;
        if (/^0x/.test(m)) return `<span class="hl-addr">${m}</span>`;
        if (m === 'HIT') return `<span class="hl-hit">${m}</span>`;
        if (m === 'MISS') return `<span class="hl-miss">${m}</span>`;
        if (/^ENCONTRADO/.test(m)) return `<span class="hl-found">${m}</span>`;
        if (/^null/i.test(m)) return `<span class="hl-null">${m}</span>`;
        if (/^(head|HEAD|tail|TAIL|top|front|rear|next|prev|push|pop|peek|enqueue|dequeue)$/i.test(m)) return `<span class="hl-kw">${m}</span>`;
        if (m === '↺') return `<span class="hl-circular">${m}</span>`;
        if (/^\d+$/.test(m)) return `<span class="hl-num">${m}</span>`;
        if (/^[→←]$/.test(m)) return `<span class="hl-arrow">${m}</span>`;
        return m;
      }
    );
  }

  function _buildLog() {
    stepLog.innerHTML = '';
    _steps.forEach((step, i) => {
      const div = document.createElement('div');
      div.className = 'log-step' + (i === _current ? ' log-step--active' : '');
      div.innerHTML = `<span class="log-step-num">${i + 1}/${_steps.length}</span>${_hl(step.description)}`;
      stepLog.appendChild(div);
    });
    // Scroll active step into view
    const active = stepLog.querySelector('.log-step--active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function _renderCurrent() {
    if (_current < 0 || _current >= _steps.length) return;
    const step = _steps[_current];
    Renderer.draw(step.snapshot);
    MemoryPanel.update(step.memory || null);
    _buildLog();
    _updateButtons();
  }

  function _updateButtons() {
    btnPrev.disabled    = _current <= 0;
    btnNext.disabled    = _current >= _steps.length - 1;
    btnRestart.disabled = _steps.length === 0;
  }

  function load(steps) {
    _stopAuto();
    _steps   = steps || [];
    _current = _steps.length > 0 ? 0 : -1;
    MemoryPanel.resetStats();
    _renderCurrent();
  }

  function next() {
    if (_current < _steps.length - 1) {
      _current++;
      _renderCurrent();
    } else {
      _stopAuto();
    }
  }

  function prev() {
    if (_current > 0) {
      _current--;
      _renderCurrent();
    }
  }

  function restart() {
    _stopAuto();
    _current = _steps.length > 0 ? 0 : -1;
    MemoryPanel.resetStats();
    _renderCurrent();
  }

  function _stopAuto() {
    clearInterval(_timer);
    _timer = null;
    btnPlay.classList.remove('is-playing');
    btnPlay.title = 'Play automático';
  }

  function _startAuto() {
    const delay = SPEEDS[sliderSpeed.value] || 650;
    btnPlay.classList.add('is-playing');
    btnPlay.title = 'Pausar';
    _timer = setInterval(() => {
      if (_current >= _steps.length - 1) {
        _stopAuto();
      } else {
        next();
      }
    }, delay);
  }

  function togglePlay() {
    if (_timer) {
      _stopAuto();
    } else {
      if (_current >= _steps.length - 1) restart();
      _startAuto();
    }
  }

  // Wire up controls
  btnPrev.addEventListener('click', prev);
  btnNext.addEventListener('click', next);
  btnPlay.addEventListener('click', togglePlay);
  btnRestart.addEventListener('click', restart);
  sliderSpeed.addEventListener('input', () => {
    _updateSpeedLabel();
    if (_timer) {         // restart auto-play with new speed
      _stopAuto();
      _startAuto();
    }
  });

  _updateSpeedLabel();
  _updateButtons();

  return { load };
})();
