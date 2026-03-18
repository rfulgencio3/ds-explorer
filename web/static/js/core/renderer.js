/**
 * renderer.js
 * Renders data structure nodes and arrows onto the SVG element.
 *
 * Uses persistent SVG elements keyed by nodeId so that CSS transitions
 * fire naturally when a node changes state (color), and appear/disappear
 * animations play on insert/remove.
 *
 * Snapshot format expected by draw():
 * {
 *   type: 'array' | 'singly' | 'doubly',
 *   nodes: [{ id, value, state }],   // state: 'neutral'|'visiting'|'success'|'danger'|'warning'
 *   pointers: { HEAD: <nodeId>, TAIL: <nodeId> }
 * }
 */

const Renderer = (() => {
  const NODE_W  = 54;
  const NODE_H  = 40;
  const H_GAP   = 28;
  const START_X = 60;
  const START_Y = 120;

  const svg = document.getElementById('viz-svg');

  // Persistent map: nodeId → { group, content, rect, valueText, indexLabel }
  let _nodeMap     = new Map();
  let _arrowLayer  = null;   // SVG <g> for arrows — rendered below nodes
  let _labelLayer  = null;   // SVG <g> for HEAD/TAIL labels — rendered above nodes
  let _initialized = false;

  // ── One-time setup ─────────────────────────────────────────────────────────

  function _init() {
    if (_initialized) return;
    _initialized = true;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrowhead" markerWidth="8" markerHeight="6"
              refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#8892a4"/>
      </marker>
      <marker id="arrowhead-prev" markerWidth="8" markerHeight="6"
              refX="0" refY="3" orient="auto-start-reverse">
        <polygon points="0 0, 8 3, 0 6" fill="#f5a623"/>
      </marker>
      <marker id="arrowhead-active" markerWidth="8" markerHeight="6"
              refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#4f8ef7"/>
      </marker>
    `;
    svg.appendChild(defs);

    // Arrow layer goes in first → drawn below node groups
    _arrowLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(_arrowLayer);

    // Label layer appended last → always on top of nodes
    _labelLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(_labelLayer);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _el(tag, attrs = {}) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function _stateClass(state) {
    const map = {
      neutral:  'node-rect--neutral',
      visiting: 'node-rect--visiting',
      success:  'node-rect--success',
      danger:   'node-rect--danger',
      warning:  'node-rect--warning',
    };
    return map[state] || 'node-rect--neutral';
  }

  /** Returns [{x, y}] centred horizontally for each node. */
  function _calcPositions(nodes) {
    const svgW   = svg.getBoundingClientRect().width || 600;
    const totalW = nodes.length * NODE_W + (nodes.length - 1) * H_GAP;
    const ox     = Math.max(START_X, (svgW - totalW) / 2);
    return nodes.map((_, i) => ({ x: ox + i * (NODE_W + H_GAP), y: START_Y }));
  }

  // ── Node lifecycle ─────────────────────────────────────────────────────────

  /**
   * Creates a new node group with a pop-in animation.
   *
   * Structure:
   *   <g class="node-group" transform="translate(x,y)">   ← position (instant)
   *     <g class="node-content node-appear">              ← scale animation
   *       <rect class="node-rect node-rect--…"/>          ← color transition
   *       <text class="node-text"/>
   *       <text class="node-index"/>   (array only)
   *     </g>
   *   </g>
   */
  function _createNode(node, pos, index, type) {
    const group = _el('g', {
      class: 'node-group',
      transform: `translate(${pos.x}, ${pos.y})`,
    });

    const content = _el('g', { class: 'node-content node-appear' });
    content.addEventListener('animationend', () => {
      content.classList.remove('node-appear');
    }, { once: true });

    const rect = _el('rect', {
      x: 0, y: 0,
      width: NODE_W, height: NODE_H,
      class: 'node-rect ' + _stateClass(node.state),
      rx: 6, ry: 6,
    });

    const valueText = _el('text', { x: NODE_W / 2, y: NODE_H / 2, class: 'node-text' });
    valueText.textContent = node.value ?? '';

    content.appendChild(rect);
    content.appendChild(valueText);

    let indexLabel = null;
    if (type === 'array') {
      indexLabel = _el('text', { x: NODE_W / 2, y: -10, class: 'node-index' });
      indexLabel.textContent = index;
      content.appendChild(indexLabel);
    }

    group.appendChild(content);

    // Insert before _labelLayer so node groups stay sandwiched between
    // the arrow layer (bottom) and the label layer (top).
    svg.insertBefore(group, _labelLayer);

    return { group, content, rect, valueText, indexLabel };
  }

  /**
   * Updates an existing node's position, state colour, value and index.
   * Position change is instant (keeps arrows aligned with nodes).
   * Colour change is animated via the CSS transition on .node-rect.
   */
  function _updateNode(els, node, pos, index, type) {
    // Move to new position immediately
    els.group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

    // Changing the class triggers the CSS fill transition
    els.rect.setAttribute('class', 'node-rect ' + _stateClass(node.state));

    els.valueText.textContent = node.value ?? '';

    if (type === 'array' && els.indexLabel) {
      els.indexLabel.textContent = index;
    }
  }

  /** Plays the shrink-out animation, then removes the group from the DOM. */
  function _removeNode(els) {
    els.content.classList.add('node-disappear');
    els.content.addEventListener('animationend', () => {
      els.group.remove();
    }, { once: true });
  }

  // ── Public: draw ───────────────────────────────────────────────────────────

  function draw(snapshot) {
    _init();

    // Remove "empty" placeholder whenever real content is coming
    const placeholder = svg.querySelector('.empty-text');
    if (placeholder) placeholder.remove();

    if (!snapshot || !snapshot.nodes || snapshot.nodes.length === 0) {
      for (const [, els] of _nodeMap) _removeNode(els);
      _nodeMap.clear();
      _arrowLayer.innerHTML = '';
      _labelLayer.innerHTML = '';
      _drawEmpty();
      return;
    }

    const type      = snapshot.type || 'array';
    const nodes     = snapshot.nodes;
    const positions = _calcPositions(nodes);

    // ① Remove nodes that no longer exist
    const newIds = new Set(nodes.map(n => n.id));
    for (const [id, els] of _nodeMap) {
      if (!newIds.has(id)) {
        _removeNode(els);
        _nodeMap.delete(id);
      }
    }

    // ② Update existing nodes / create new ones
    nodes.forEach((node, i) => {
      if (_nodeMap.has(node.id)) {
        _updateNode(_nodeMap.get(node.id), node, positions[i], i, type);
      } else {
        const els = _createNode(node, positions[i], i, type);
        _nodeMap.set(node.id, els);
      }
    });

    // ③ Redraw arrows and pointer labels (cheap — no animation needed)
    _arrowLayer.innerHTML = '';
    _labelLayer.innerHTML = '';

    if (type !== 'array') {
      _drawLinkedListArrows(snapshot, positions, nodes);
    }
    _drawPointerLabels(positions, nodes, type);
  }

  // ── Arrow drawing ──────────────────────────────────────────────────────────

  function _drawArrow(x1, y1, x2, y2, opts = {}) {
    const line = _el('line', {
      x1, y1, x2, y2,
      class: 'arrow-line'
            + (opts.null ? ' arrow-line--null' : '')
            + (opts.prev ? ' arrow-line--prev' : ''),
      'marker-end': opts.prev ? 'url(#arrowhead-prev)' : 'url(#arrowhead)',
    });
    _arrowLayer.appendChild(line);
  }

  function _drawLinkedListArrows(snapshot, positions, nodes) {
    const isDbl = snapshot.type === 'doubly';

    nodes.forEach((_, i) => {
      const { x, y } = positions[i];

      if (i < nodes.length - 1) {
        const nx = positions[i + 1].x;
        // next arrow →
        _drawArrow(x + NODE_W + 2, y + NODE_H / 2, nx - 2, y + NODE_H / 2);
        if (isDbl) {
          // prev arrow ← (slightly below)
          _drawArrow(nx - 2, y + NODE_H / 2 + 8, x + NODE_W + 2, y + NODE_H / 2 + 8, { prev: true });
        }
      } else {
        // Null pointer stub at the last node
        _drawArrow(
          x + NODE_W + 2, y + NODE_H / 2,
          x + NODE_W + H_GAP - 8, y + NODE_H / 2,
          { null: true },
        );
        const nullLabel = _el('text', {
          x: x + NODE_W + H_GAP - 2,
          y: y + NODE_H / 2,
          class: 'node-index',
          'dominant-baseline': 'middle',
        });
        nullLabel.textContent = 'null';
        _arrowLayer.appendChild(nullLabel);
      }
    });
  }

  function _drawPointerLabels(positions, nodes, type) {
    if (type === 'array' || nodes.length === 0) return;

    _drawPointerLabel('HEAD', positions[0].x, positions[0].y);

    if (type === 'doubly') {
      _drawPointerLabel('TAIL', positions[nodes.length - 1].x, positions[nodes.length - 1].y);
    }
  }

  function _drawPointerLabel(name, nodeX, nodeY) {
    const cx = nodeX + NODE_W / 2;
    const cy = nodeY - 28;

    const arrow = _el('line', {
      x1: cx, y1: cy + 12,
      x2: cx, y2: nodeY - 4,
      class: 'arrow-line',
      'marker-end': 'url(#arrowhead-active)',
      stroke: 'var(--color-primary)',
    });
    _labelLayer.appendChild(arrow);

    const label = _el('text', { x: cx, y: cy, class: 'pointer-label' });
    label.textContent = name;
    _labelLayer.appendChild(label);
  }

  function _drawEmpty() {
    if (svg.querySelector('.empty-text')) return;
    const text = _el('text', {
      x: '50%', y: '50%',
      'dominant-baseline': 'middle',
      'text-anchor': 'middle',
      class: 'node-text empty-text',
      fill: 'var(--color-text-muted)',
    });
    text.textContent = 'Gere uma estrutura para visualizar';
    svg.appendChild(text);
  }

  return { draw };
})();
