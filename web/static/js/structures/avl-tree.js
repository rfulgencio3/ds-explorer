/**
 * avl-tree.js - BST auto-balanceada com destaque de fator de balanceamento.
 */
function initStructurePage() {
  let root = null;
  let nextId = 0;
  const MAX_SIZE = 24;
  const BYTES_PER_NODE = 28;
  const BASE_ADDR = 0xB000;
  let _prevAccessedId = -1;

  const meta = window.__STRUCTURE_DATA__;
  const selectOp = document.getElementById('select-operation');
  const inputSize = document.getElementById('input-size');
  const btnGenerate = document.getElementById('btn-generate');
  const btnExecute = document.getElementById('btn-execute');
  const fieldValue = document.getElementById('field-value');
  const fieldIndex = document.getElementById('field-index');
  const fieldNewVal = document.getElementById('field-new-value');
  const inputValue = document.getElementById('input-value');

  inputSize.max = '15';
  selectOp.innerHTML = `
    <optgroup label="AVL">
      <option value="insert">Inserir</option>
      <option value="search">Buscar</option>
      <option value="remove">Remover</option>
    </optgroup>
  `;

  const fieldMap = { insert: ['value'], search: ['value'], remove: ['value'] };
  function _syncFields() { StructureUI.syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, fieldMap); }
  selectOp.addEventListener('change', _syncFields);
  _syncFields();

  StructureUI.initMeta(meta, 'Arvore AVL');
  MemoryPanel.init('tree');

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(15, Math.max(2, parseInt(inputSize.value, 10) || 7));
    root = null;
    nextId = 0;
    const values = [];
    while (values.length < size) {
      const value = Math.floor(Math.random() * 90) + 1;
      if (!values.includes(value)) values.push(value);
    }
    values.forEach(value => { root = _insertAvl(root, value, []); });
    _prevAccessedId = -1;
    Animator.load([{
      description: `AVL gerada com ${size} valores. Cada no mostra h=altura e b=fator de balanceamento.`,
      snapshot: _snapshot(root),
      memory: _buildMemory(root, null),
    }]);
  });
  btnGenerate.click();

  btnExecute.addEventListener('click', () => {
    const value = parseInt(inputValue.value, 10);
    if (isNaN(value)) { alert('Informe um valor.'); return; }
    _prevAccessedId = -1;
    let result = { steps: [] };
    switch (selectOp.value) {
      case 'insert': result = _insert(value); break;
      case 'search': result = _search(value); break;
      case 'remove': result = _remove(value); break;
    }
    if (result.steps.length > 0) {
      root = result.root;
      Animator.load(result.steps);
    }
  });

  function _newNode(value) { return { id: nextId++, value, height: 1, left: null, right: null }; }
  function _h(node) { return node ? node.height : 0; }
  function _balance(node) { return node ? _h(node.left) - _h(node.right) : 0; }
  function _update(node) { if (node) node.height = Math.max(_h(node.left), _h(node.right)) + 1; return node; }

  function _rotateRight(y) {
    const x = y.left;
    const t2 = x.right;
    x.right = y;
    y.left = t2;
    _update(y);
    _update(x);
    return x;
  }

  function _rotateLeft(x) {
    const y = x.right;
    const t2 = y.left;
    y.left = x;
    x.right = t2;
    _update(x);
    _update(y);
    return y;
  }

  function _insert(value) {
    if (_flatten(root).length >= MAX_SIZE) { alert(`A AVL suporta no maximo ${MAX_SIZE} nos.`); return { steps: [], root }; }
    const tree = _clone(root);
    const steps = [{ description: `Inserir ${value}: mesma busca da BST, seguida de atualizacao de altura.`, snapshot: _snapshot(tree), memory: _buildMemory(tree, null) }];
    const result = _insertAvl(tree, value, steps);
    steps.push({
      description: `Insercao concluida. A AVL restaura |balance| <= 1 com rotacoes quando necessario. Custo O(log n).`,
      snapshot: _snapshot(result, [], 'neutral'),
      memory: _buildMemory(result, null),
    });
    return { steps, root: result };
  }

  function _insertAvl(node, value, steps) {
    if (!node) {
      const created = _newNode(value);
      steps.push?.({ description: `Criando no ${value}.`, snapshot: _snapshot(root, [], 'neutral'), memory: _buildMemory(root, null) });
      return created;
    }

    steps.push?.({
      description: `Comparando ${value} com ${node.value}. ${value < node.value ? 'Descer esquerda.' : value > node.value ? 'Descer direita.' : 'Duplicado; ignorar.'}`,
      snapshot: _snapshot(root || node, [node.id], 'visiting'),
      memory: _buildMemory(root || node, node.id),
    });

    if (value < node.value) node.left = _insertAvl(node.left, value, steps);
    else if (value > node.value) node.right = _insertAvl(node.right, value, steps);
    else return node;

    _update(node);
    const b = _balance(node);
    steps.push?.({
      description: `Atualizando ${node.value}: altura=${node.height}, balance=${b}. ${Math.abs(b) > 1 ? 'Rebalancear.' : 'Dentro do limite.'}`,
      snapshot: _snapshot(root || node, [node.id], Math.abs(b) > 1 ? 'warning' : 'visiting'),
      memory: _buildMemory(root || node, node.id),
    });

    if (b > 1 && value < node.left.value) {
      steps.push?.({ description: `Caso LL em ${node.value}: rotacao direita.`, snapshot: _snapshot(root || node, [node.id, node.left.id], 'warning'), memory: _buildMemory(root || node, node.id) });
      return _rotateRight(node);
    }
    if (b < -1 && value > node.right.value) {
      steps.push?.({ description: `Caso RR em ${node.value}: rotacao esquerda.`, snapshot: _snapshot(root || node, [node.id, node.right.id], 'warning'), memory: _buildMemory(root || node, node.id) });
      return _rotateLeft(node);
    }
    if (b > 1 && value > node.left.value) {
      steps.push?.({ description: `Caso LR em ${node.value}: rotacao esquerda no filho, depois direita.`, snapshot: _snapshot(root || node, [node.id, node.left.id], 'warning'), memory: _buildMemory(root || node, node.id) });
      node.left = _rotateLeft(node.left);
      return _rotateRight(node);
    }
    if (b < -1 && value < node.right.value) {
      steps.push?.({ description: `Caso RL em ${node.value}: rotacao direita no filho, depois esquerda.`, snapshot: _snapshot(root || node, [node.id, node.right.id], 'warning'), memory: _buildMemory(root || node, node.id) });
      node.right = _rotateRight(node.right);
      return _rotateLeft(node);
    }
    return node;
  }

  function _search(value) {
    const steps = [{ description: `Buscar ${value}: altura balanceada mantem caminho O(log n).`, snapshot: _snapshot(root), memory: _buildMemory(root, null) }];
    let current = root;
    while (current) {
      const found = current.value === value;
      steps.push({
        description: `Visitando ${current.value}. ${found ? 'ENCONTRADO!' : value < current.value ? 'Ir para esquerda.' : 'Ir para direita.'}`,
        snapshot: _snapshot(root, [current.id], found ? 'success' : 'visiting'),
        memory: _buildMemory(root, current.id),
      });
      if (found) return { steps, root };
      current = value < current.value ? current.left : current.right;
    }
    steps.push({ description: `${value} nao encontrado.`, snapshot: _snapshot(root), memory: _buildMemory(root, null) });
    return { steps, root };
  }

  function _remove(value) {
    const tree = _clone(root);
    const steps = [{ description: `Remover ${value}: apos a remocao, alturas e rotacoes sao recalculadas.`, snapshot: _snapshot(tree), memory: _buildMemory(tree, null) }];
    const result = _deleteAvl(tree, value, steps);
    steps.push({ description: `Remocao finalizada com rebalanceamento AVL.`, snapshot: _snapshot(result), memory: _buildMemory(result, null) });
    return { steps, root: result };
  }

  function _deleteAvl(node, value, steps) {
    if (!node) return null;
    steps.push({ description: `Comparando ${value} com ${node.value}.`, snapshot: _snapshot(root || node, [node.id], 'visiting'), memory: _buildMemory(root || node, node.id) });
    if (value < node.value) node.left = _deleteAvl(node.left, value, steps);
    else if (value > node.value) node.right = _deleteAvl(node.right, value, steps);
    else {
      steps.push({ description: `No ${node.value} encontrado para remocao.`, snapshot: _snapshot(root || node, [node.id], 'danger'), memory: _buildMemory(root || node, node.id) });
      if (!node.left || !node.right) return node.left || node.right;
      const successor = _minNode(node.right);
      node.value = successor.value;
      node.right = _deleteAvl(node.right, successor.value, steps);
    }

    _update(node);
    const b = _balance(node);
    if (b > 1 && _balance(node.left) >= 0) return _rotateRight(node);
    if (b > 1 && _balance(node.left) < 0) {
      node.left = _rotateLeft(node.left);
      return _rotateRight(node);
    }
    if (b < -1 && _balance(node.right) <= 0) return _rotateLeft(node);
    if (b < -1 && _balance(node.right) > 0) {
      node.right = _rotateRight(node.right);
      return _rotateLeft(node);
    }
    return node;
  }

  function _minNode(node) { while (node.left) node = node.left; return node; }

  function _nodeAddr(id) {
    const offset = ((id * 2246822519) >>> 0) % 0x5000;
    const hex = (BASE_ADDR + (offset & ~0xF)).toString(16).toUpperCase();
    return '0x' + hex.padStart(4, '0');
  }

  function _buildMemory(tree, accessedId) {
    const nodes = _flatten(tree);
    const hit = accessedId != null && accessedId === _prevAccessedId;
    if (accessedId != null) _prevAccessedId = accessedId;
    return {
      type: 'tree',
      totalBytes: nodes.length * BYTES_PER_NODE,
      event: accessedId == null ? null : hit ? 'hit' : 'miss',
      cycles: accessedId == null ? null : hit ? 4 : 200,
      note: accessedId == null ? 'AVL guarda valor, dois ponteiros e altura.' : `Acesso ao no em ${_nodeAddr(accessedId)}.`,
      accessedIdx: accessedId == null ? null : nodes.findIndex(n => n.id === accessedId),
      layout: nodes.map(n => ({ value: n.value, addr: _nodeAddr(n.id) })),
    };
  }

  function _snapshot(tree, highlighted = [], state = 'visiting') {
    const nodes = [];
    let order = 0;
    function walk(node, depth, parent) {
      if (!node) return;
      walk(node.left, depth + 1, node.id);
      nodes.push({
        id: node.id,
        value: node.value,
        state: highlighted.includes(node.id) ? state : 'neutral',
        parent,
        depth,
        order: order++,
        meta: `h${node.height}|b${_balance(node)}`,
      });
      walk(node.right, depth + 1, node.id);
    }
    walk(tree, 0, null);
    nodes.sort((a, b) => a.depth - b.depth || a.order - b.order);
    return { type: 'tree', nodes, rootLabel: 'root' };
  }

  function _flatten(tree) {
    const out = [];
    (function walk(node) {
      if (!node) return;
      out.push(node);
      walk(node.left);
      walk(node.right);
    })(tree);
    return out;
  }

  function _clone(node) {
    if (!node) return null;
    return { id: node.id, value: node.value, height: node.height, left: _clone(node.left), right: _clone(node.right) };
  }
}
