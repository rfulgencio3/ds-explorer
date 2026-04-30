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
 *   type: 'array' | 'singly' | 'doubly' | 'circular' | 'stack' | 'queue' | 'circular-queue' | 'deque' | 'tree',
 *   nodes: [{ id, value, state }],   // state: 'neutral'|'visiting'|'success'|'danger'|'warning'
 *   pointers: { HEAD: <nodeId>, TAIL: <nodeId> }
 * }
 */

const Renderer = (() => {
  const NODE_W  = 54;
  const NODE_H  = 40;
  const H_GAP   = 28;
  const V_GAP   = 14;
  const START_X = 60;
  const START_Y = 120;

  const svg = document.getElementById('viz-svg');

  // ── Type strategies ────────────────────────────────────────────────────────
  // To support a new structure type: add one entry here.
  // No other function in this module needs to be modified.
  const _typeStrategies = {
    array: {
      drawArrows:    null,
      typeLabel:     ()      => ({ text: 'int32', x: NODE_W / 2, y: -22 }),
      showIndex:     true,
      pointerLabels: [],
    },
    singly: {
      drawArrows:    (snap, pos, nds) => _drawLinkedListArrows(snap, pos, nds),
      typeLabel:     ()      => ({ text: 'node*', x: 4, y: 9 }),
      showIndex:     false,
      pointerLabels: ['head'],
    },
    doubly: {
      drawArrows:    (snap, pos, nds) => _drawLinkedListArrows(snap, pos, nds),
      typeLabel:     ()      => ({ text: 'dbl*',  x: 4, y: 9 }),
      showIndex:     false,
      pointerLabels: ['head', 'tail'],
    },
    circular: {
      drawArrows:    (snap, pos, nds) => _drawCircularArrows(pos, nds),
      typeLabel:     ()      => ({ text: 'node*', x: 4, y: 9 }),
      showIndex:     false,
      pointerLabels: ['head', 'tail'],
    },
    stack: {
      calcPositions: (nds) => _calcStackPositions(nds),
      drawBackdrop:  (snap, pos, nds) => _drawStackBackdrop(pos, nds),
      drawArrows:    (snap, pos, nds) => _drawStackArrows(pos, nds),
      typeLabel:     ()      => ({ text: 'node*', x: 4, y: 9 }),
      showIndex:     false,
      pointerLabels: ['top'],
      appearClass:   'node-appear--stack',
      disappearClass:'node-disappear--stack',
    },
    queue: {
      drawBackdrop:  (snap, pos, nds) => _drawQueueBackdrop(pos, nds),
      drawArrows:    (snap, pos, nds) => _drawLinkedListArrows(snap, pos, nds),
      typeLabel:     ()      => ({ text: 'node*', x: 4, y: 9 }),
      showIndex:     false,
      pointerLabels: ['front', 'rear'],
      appearClass:   'node-appear--queue',
      disappearClass:'node-disappear--queue',
    },
    'circular-queue': {
      drawBackdrop:  (snap, pos, nds) => _drawCircularQueueBackdrop(pos, nds),
      drawArrows:    null,
      typeLabel:     ()      => ({ text: 'slot', x: NODE_W / 2, y: -22 }),
      showIndex:     true,
      pointerResolver: (snapshot) => ([
        snapshot.pointers?.front ? { name: 'front', targetId: snapshot.pointers.front } : null,
        snapshot.pointers?.rear ? { name: 'rear', targetId: snapshot.pointers.rear } : null,
      ].filter(Boolean)),
    },
    deque: {
      drawBackdrop:  (snap, pos, nds) => _drawQueueBackdrop(pos, nds, 'dupla extremidade'),
      drawArrows:    (snap, pos, nds) => _drawLinkedListArrows(snap, pos, nds),
      typeLabel:     ()      => ({ text: 'dbl*', x: 4, y: 9 }),
      showIndex:     false,
      pointerResolver: (snapshot) => ([
        snapshot.pointers?.front ? { name: 'front', targetId: snapshot.pointers.front } : null,
        snapshot.pointers?.rear ? { name: 'rear', targetId: snapshot.pointers.rear } : null,
      ].filter(Boolean)),
      appearClass:   'node-appear--queue',
      disappearClass:'node-disappear--queue',
    },
    tree: {
      calcPositions: (nds) => _calcTreePositions(nds),
      drawArrows:    (snap, pos, nds) => _drawTreeArrows(pos, nds),
      typeLabel:     (i, node) => ({ text: node.meta || 'node*', x: NODE_W / 2, y: -22 }),
      showIndex:     false,
      pointerResolver: (snapshot, nodes) => ([
        nodes[0] ? { name: snapshot.rootLabel || 'root', targetId: nodes[0].id } : null,
      ].filter(Boolean)),
    },
  };

  function _getStrategy(type) {
    return _typeStrategies[type] || _typeStrategies.singly;
  }

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
      <marker id="arrowhead-circular" markerWidth="8" markerHeight="6"
              refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#3d8fd4"/>
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

  function _calcStackPositions(nodes) {
    const svgW   = svg.getBoundingClientRect().width || 600;
    const totalH = nodes.length * NODE_H + Math.max(0, nodes.length - 1) * V_GAP;
    const ox     = Math.max(START_X + 24, (svgW - NODE_W) / 2);
    const oy     = Math.max(54, (300 - totalH) / 2);
    return nodes.map((_, i) => ({ x: ox, y: oy + i * (NODE_H + V_GAP) }));
  }

  function _calcTreePositions(nodes) {
    const svgW = svg.getBoundingClientRect().width || 760;
    const byOrder = nodes
      .map((node, i) => ({ node, i }))
      .sort((a, b) => (a.node.order ?? a.i) - (b.node.order ?? b.i));
    const orderById = new Map();
    byOrder.forEach((item, order) => orderById.set(item.node.id, order));

    const totalW = Math.max(1, nodes.length) * (NODE_W + H_GAP);
    const ox = Math.max(START_X, (svgW - totalW) / 2);

    return nodes.map((node, i) => {
      const order = orderById.get(node.id) ?? i;
      return {
        x: ox + order * (NODE_W + H_GAP),
        y: 62 + (node.depth || 0) * (NODE_H + 48),
      };
    });
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
    const strategy = _getStrategy(type);
    const group = _el('g', {
      class: 'node-group',
      transform: `translate(${pos.x}, ${pos.y})`,
    });
    group.dataset.type = type;
    group.dataset.index = String(index);

    const content = _el('g', { class: `node-content ${strategy.appearClass || 'node-appear'}` });
    content.addEventListener('animationend', () => {
      content.classList.remove(strategy.appearClass || 'node-appear');
    }, { once: true });

    const rect = _el('rect', {
      x: 0, y: 0,
      width: NODE_W, height: NODE_H,
      class: 'node-rect ' + _stateClass(node.state),
      rx: 6, ry: 6,
    });

    // Value text — styled as a numeric literal (warm orange, like editors)
    const valueText = _el('text', { x: NODE_W / 2, y: NODE_H / 2, class: 'node-text node-value' });
    valueText.textContent = node.value ?? '';

    content.appendChild(rect);
    content.appendChild(valueText);

    let indexLabel  = null;
    let typeLabel   = null;

    const tl = strategy.typeLabel(index, node);
    typeLabel = _el('text', { x: tl.x, y: tl.y, class: 'node-type-label' });
    typeLabel.textContent = tl.text;
    content.appendChild(typeLabel);

    if (strategy.showIndex) {
      // Index in [i] bracket notation — looks like array access syntax
      indexLabel = _el('text', { x: NODE_W / 2, y: -10, class: 'node-index' });
      indexLabel.textContent = `[${index}]`;
      content.appendChild(indexLabel);
    }

    group.appendChild(content);

    // Insert before _labelLayer so node groups stay sandwiched between
    // the arrow layer (bottom) and the label layer (top).
    svg.insertBefore(group, _labelLayer);

    return { group, content, rect, valueText, indexLabel, typeLabel };
  }

  /**
   * Updates an existing node's position, state colour, value and index.
   * Position change is instant (keeps arrows aligned with nodes).
   * Colour change is animated via the CSS transition on .node-rect.
   */
  function _updateNode(els, node, pos, index, type) {
    // Move to new position immediately
    els.group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    els.group.dataset.type = type;
    els.group.dataset.index = String(index);

    // Changing the class triggers the CSS fill transition
    els.rect.setAttribute('class', 'node-rect ' + _stateClass(node.state));

    els.valueText.textContent = node.value ?? '';

    if (_getStrategy(type).showIndex && els.indexLabel) {
      els.indexLabel.textContent = `[${index}]`;
    }
  }

  /** Plays the shrink-out animation, then removes the group from the DOM. */
  function _removeNode(els) {
    const type = els.group.dataset.type || 'array';
    const strategy = _getStrategy(type);
    els.content.classList.add(strategy.disappearClass || 'node-disappear');
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
      svg.style.minWidth = '';
      svg.style.minHeight = '';
      for (const [, els] of _nodeMap) _removeNode(els);
      _nodeMap.clear();
      _arrowLayer.innerHTML = '';
      _labelLayer.innerHTML = '';
      _drawEmpty();
      return;
    }

    const type  = snapshot.type || 'array';
    const nodes = snapshot.nodes;
    const strategy = _getStrategy(type);

    if (type === 'tree') {
      const maxDepth = Math.max(...nodes.map(n => n.depth || 0), 0);
      const contentW = nodes.length * (NODE_W + H_GAP) + START_X * 2;
      const contentH = (maxDepth + 1) * (NODE_H + 48) + 90;
      svg.style.minWidth = Math.max(640, contentW) + 'px';
      svg.style.minHeight = Math.max(320, contentH) + 'px';
    } else if (type === 'stack') {
      const contentH = nodes.length * NODE_H + Math.max(0, nodes.length - 1) * V_GAP;
      const neededH  = Math.max(240, contentH + 110);
      const neededW  = Math.max(240, NODE_W + START_X * 2);
      svg.style.minWidth = neededW + 'px';
      svg.style.minHeight = neededH + 'px';
    } else {
      // Expand SVG width so long structures get a horizontal scroll instead of clipping.
      // Must be set BEFORE _calcPositions() reads svg.getBoundingClientRect().width.
      const contentW = nodes.length * NODE_W + Math.max(0, nodes.length - 1) * H_GAP;
      const neededW  = contentW + START_X * 2 + (type !== 'array' ? H_GAP + 30 : 0);
      svg.style.minWidth = neededW + 'px';
      svg.style.minHeight = '';
    }

    const positions = strategy.calcPositions ? strategy.calcPositions(nodes) : _calcPositions(nodes);

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

    if (strategy.drawBackdrop) strategy.drawBackdrop(snapshot, positions, nodes);
    if (strategy.drawArrows) strategy.drawArrows(snapshot, positions, nodes);
    _drawPointerLabels(snapshot, positions, nodes, strategy);
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
    const isDbl = snapshot.type === 'doubly' || snapshot.type === 'deque';

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
          class: 'pointer-label',
          'dominant-baseline': 'middle',
          fill: '#8baac8',   // hl-null color (keyword style)
        });
        nullLabel.textContent = 'null';
        _arrowLayer.appendChild(nullLabel);
      }
    });
  }

  function _drawStackArrows(positions, nodes) {
    nodes.forEach((_, i) => {
      const { x, y } = positions[i];

      if (i < nodes.length - 1) {
        const ny = positions[i + 1].y;
        _drawArrow(x + NODE_W / 2, y + NODE_H + 2, x + NODE_W / 2, ny - 2);
      } else {
        _drawArrow(
          x + NODE_W / 2, y + NODE_H + 2,
          x + NODE_W / 2, y + NODE_H + V_GAP + 8,
          { null: true },
        );
        const nullLabel = _el('text', {
          x: x + NODE_W / 2,
          y: y + NODE_H + V_GAP + 18,
          class: 'pointer-label',
          'dominant-baseline': 'middle',
          fill: '#8baac8',
        });
        nullLabel.textContent = 'null';
        _arrowLayer.appendChild(nullLabel);
      }
    });
  }

  function _drawStackBackdrop(positions, nodes) {
    if (nodes.length === 0) return;
    const left = positions[0].x - 18;
    const right = positions[0].x + NODE_W + 18;
    const top = positions[0].y - 14;
    const bottom = positions[nodes.length - 1].y + NODE_H + 14;

    const leftRail = _el('line', {
      x1: left, y1: top, x2: left, y2: bottom,
      class: 'structure-guide structure-guide--stack',
    });
    const rightRail = _el('line', {
      x1: right, y1: top, x2: right, y2: bottom,
      class: 'structure-guide structure-guide--stack',
    });
    const base = _el('line', {
      x1: left - 2, y1: bottom, x2: right + 2, y2: bottom,
      class: 'structure-guide structure-guide--stack',
    });

    _arrowLayer.appendChild(leftRail);
    _arrowLayer.appendChild(rightRail);
    _arrowLayer.appendChild(base);
  }

  function _drawQueueBackdrop(positions, nodes, labelText = 'fluxo FIFO') {
    if (nodes.length === 0) return;
    const left = positions[0].x - 20;
    const right = positions[nodes.length - 1].x + NODE_W + 20;
    const y = positions[0].y + NODE_H + 22;

    const rail = _el('line', {
      x1: left, y1: y, x2: right, y2: y,
      class: 'structure-guide structure-guide--queue',
      'marker-end': 'url(#arrowhead)',
    });
    const label = _el('text', {
      x: (left + right) / 2,
      y: y + 18,
      class: 'structure-guide-label',
      'text-anchor': 'middle',
    });
    label.textContent = labelText;

    _arrowLayer.appendChild(rail);
    _arrowLayer.appendChild(label);
  }

  function _drawCircularQueueBackdrop(positions, nodes) {
    if (nodes.length === 0) return;
    const first = positions[0];
    const last = positions[nodes.length - 1];
    const left = first.x - 16;
    const right = last.x + NODE_W + 16;
    const top = first.y - 22;
    const bottom = first.y + NODE_H + 30;

    const d = [
      `M ${left} ${first.y + NODE_H / 2}`,
      `Q ${left} ${top} ${first.x + NODE_W / 2} ${top}`,
      `L ${last.x + NODE_W / 2} ${top}`,
      `Q ${right} ${top} ${right} ${first.y + NODE_H / 2}`,
      `L ${right} ${bottom}`,
      `Q ${right} ${bottom + 18} ${last.x + NODE_W / 2} ${bottom + 18}`,
      `L ${first.x + NODE_W / 2} ${bottom + 18}`,
      `Q ${left} ${bottom + 18} ${left} ${bottom}`,
      `L ${left} ${first.y + NODE_H / 2}`,
    ].join(' ');

    const frame = _el('path', {
      d,
      class: 'structure-guide structure-guide--queue',
      'marker-end': 'url(#arrowhead-circular)',
    });
    const label = _el('text', {
      x: (left + right) / 2,
      y: bottom + 36,
      class: 'structure-guide-label',
      'text-anchor': 'middle',
    });
    label.textContent = 'buffer circular';

    _arrowLayer.appendChild(frame);
    _arrowLayer.appendChild(label);
  }

  function _drawTreeArrows(positions, nodes) {
    const posById = new Map(nodes.map((node, i) => [node.id, positions[i]]));

    nodes.forEach((node, i) => {
      if (node.parent == null) return;
      const parent = posById.get(node.parent);
      const child = positions[i];
      if (!parent || !child) return;

      _drawArrow(
        parent.x + NODE_W / 2,
        parent.y + NODE_H + 2,
        child.x + NODE_W / 2,
        child.y - 4,
      );
    });
  }

  /** Draws arrows for a circular singly-linked list.
   *  Consecutive arrows go right (same as singly).
   *  The last→first wrap-around is shown as a rounded path below the nodes. */
  function _drawCircularArrows(positions, nodes) {
    if (nodes.length === 0) return;

    // Draw next arrows between consecutive nodes
    for (let i = 0; i < nodes.length - 1; i++) {
      const { x, y } = positions[i];
      const nx = positions[i + 1].x;
      _drawArrow(x + NODE_W + 2, y + NODE_H / 2, nx - 2, y + NODE_H / 2);
    }

    // Circular wrap-around arrow: last node → first node
    const first = positions[0];
    const last  = positions[nodes.length - 1];
    const below = first.y + NODE_H + 48;

    // U-shaped path: exit last node right → go down → go left → enter first node left
    const x1 = last.x  + NODE_W + 14;
    const x0 = first.x - 14;
    const d  = [
      `M ${last.x + NODE_W + 2} ${last.y  + NODE_H / 2}`,
      `L ${x1}                  ${last.y  + NODE_H / 2}`,
      `L ${x1}                  ${below}`,
      `L ${x0}                  ${below}`,
      `L ${x0}                  ${first.y + NODE_H / 2}`,
      `L ${first.x - 2}         ${first.y + NODE_H / 2}`,
    ].join(' ');

    const path = _el('path', {
      d,
      class: 'arrow-line arrow-line--circular',
      fill: 'none',
      'marker-end': 'url(#arrowhead-circular)',
    });
    _arrowLayer.appendChild(path);

    // Label "↺" at the midpoint of the bottom arc
    const midX = (x1 + x0) / 2;
    const label = _el('text', {
      x: midX, y: below + 13,
      class: 'pointer-label',
      'dominant-baseline': 'middle',
      'text-anchor': 'middle',
    });
    label.textContent = 'tail.next → head';
    _arrowLayer.appendChild(label);

    const nextLabel = _el('text', {
      x: first.x + NODE_W + H_GAP / 2,
      y: first.y + NODE_H / 2 - 10,
      class: 'structure-guide-label',
      'text-anchor': 'middle',
    });
    nextLabel.textContent = 'next';
    _arrowLayer.appendChild(nextLabel);
  }

  function _drawPointerLabels(snapshot, positions, nodes, strategy) {
    const targets = _resolvePointerTargets(snapshot, nodes, strategy);
    if (nodes.length === 0 || targets.length === 0) return;

    // Lowercase style — matches coding convention (variable names, not constants)
    targets.forEach(({ name, targetId }) => {
      const idx = nodes.findIndex(node => node.id === targetId);
      if (idx >= 0) _drawPointerLabel(name, positions[idx].x, positions[idx].y);
    });
  }

  function _resolvePointerTargets(snapshot, nodes, strategy) {
    if (strategy.pointerResolver) {
      return strategy.pointerResolver(snapshot, nodes);
    }

    const labels = strategy.pointerLabels || [];
    const targets = [];
    if (labels.includes('head') && nodes[0]) targets.push({ name: 'head', targetId: nodes[0].id });
    if (labels.includes('tail') && nodes[nodes.length - 1]) targets.push({ name: 'tail', targetId: nodes[nodes.length - 1].id });
    if (labels.includes('top') && nodes[0]) targets.push({ name: 'top', targetId: nodes[0].id });
    if (labels.includes('front') && nodes[0]) targets.push({ name: 'front', targetId: nodes[0].id });
    if (labels.includes('rear') && nodes[nodes.length - 1]) targets.push({ name: 'rear', targetId: nodes[nodes.length - 1].id });
    return targets;
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
