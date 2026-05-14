/**
 * binary-search-tree.js - arvore binaria de busca com visualizacao em niveis.
 */
function initStructurePage() {
  let root = null;
  let nextId = 0;
  const MAX_SIZE = 24;

  // ── UI ────────────────────────────────────────────────────────────────
  const { btnGenerate, btnExecute, inputSize, inputValue } = StructureUI.bootstrap({
    fallbackName: 'Arvore Binaria de Busca',
    memoryType:   'tree',
    maxSize:      15,
    fieldMap:     { insert: ['value'], search: ['value'], remove: ['value'] },
    selectHtml: `
      <optgroup label="BST">
        <option value="insert">Inserir</option>
        <option value="search">Buscar</option>
        <option value="remove">Remover</option>
      </optgroup>
    `,
  });

  // ── Memory ────────────────────────────────────────────────────────────
  const _mem = MemoryHelpers.forLinked({
    type: 'tree', bytesPerNode: 24, baseAddr: 0xA000,
    hashMult: 2654435761, rangeSize: 0x5000, alignMask: ~0xF,
    idleNote: 'Nos de arvore ficam dispersos no heap.',
    missNote: addr => `Acesso ao no em ${addr} por ponteiro.`,
  });

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(15, Math.max(2, parseInt(inputSize.value, 10) || 7));
    root = null;
    nextId = 0;
    const values = [];
    while (values.length < size) {
      const value = Math.floor(Math.random() * 90) + 1;
      if (!values.includes(value)) values.push(value);
    }
    values.forEach(value => { root = _insertNode(root, value); });
    _mem.reset();
    Animator.load([{
      description: `BST gerada com ${size} valores. Menores ficam a esquerda, maiores a direita.`,
      snapshot: _snapshot(root, [], 'neutral'),
      memory: _buildMemory(root, null),
    }]);
  });
  btnGenerate.click();

  btnExecute.addEventListener('click', () => {
    const value = parseInt(inputValue.value, 10);
    if (isNaN(value)) { alert('Informe um valor.'); return; }
    _mem.reset();
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

  function _newNode(value) { return { id: nextId++, value, left: null, right: null }; }

  function _insertNode(node, value) {
    if (!node) return _newNode(value);
    if (value < node.value) node.left = _insertNode(node.left, value);
    else if (value > node.value) node.right = _insertNode(node.right, value);
    return node;
  }

  function _insert(value) {
    if (_size(root) >= MAX_SIZE) { alert(`A BST suporta no maximo ${MAX_SIZE} nos.`); return { steps: [], root }; }
    const tree = _clone(root);
    const steps = [{ description: `Inserir ${value}: comecando pela raiz.`, snapshot: _snapshot(tree), memory: _buildMemory(tree, null) }];

    if (!tree) {
      const newRoot = _newNode(value);
      steps.push({ description: `Arvore vazia: ${value} vira root.`, snapshot: _snapshot(newRoot, [newRoot.id], 'success'), memory: _buildMemory(newRoot, newRoot.id) });
      return { steps, root: newRoot };
    }

    let current = tree;
    while (current) {
      steps.push({
        description: `Comparando ${value} com ${current.value}. ${value < current.value ? 'Ir para a esquerda.' : value > current.value ? 'Ir para a direita.' : 'Valor duplicado; nao inserir.'}`,
        snapshot: _snapshot(tree, [current.id], value === current.value ? 'warning' : 'visiting'),
        memory: _buildMemory(tree, current.id),
      });
      if (value === current.value) return { steps, root: tree };
      if (value < current.value) {
        if (!current.left) {
          current.left = _newNode(value);
          steps.push({ description: `${value} inserido como filho esquerdo de ${current.value}. Custo O(h).`, snapshot: _snapshot(tree, [current.left.id], 'success'), memory: _buildMemory(tree, current.left.id) });
          return { steps, root: tree };
        }
        current = current.left;
      } else {
        if (!current.right) {
          current.right = _newNode(value);
          steps.push({ description: `${value} inserido como filho direito de ${current.value}. Custo O(h).`, snapshot: _snapshot(tree, [current.right.id], 'success'), memory: _buildMemory(tree, current.right.id) });
          return { steps, root: tree };
        }
        current = current.right;
      }
    }
    return { steps, root: tree };
  }

  function _search(value) {
    const steps = [{ description: `Buscar ${value}: cada comparacao elimina uma subarvore.`, snapshot: _snapshot(root), memory: _buildMemory(root, null) }];
    let current = root;
    while (current) {
      const found = current.value === value;
      steps.push({
        description: `Visitando ${current.value}. ${found ? 'ENCONTRADO!' : value < current.value ? `${value} e menor; esquerda.` : `${value} e maior; direita.`}`,
        snapshot: _snapshot(root, [current.id], found ? 'success' : 'visiting'),
        memory: _buildMemory(root, current.id),
      });
      if (found) return { steps, root };
      current = value < current.value ? current.left : current.right;
    }
    steps.push({ description: `${value} nao encontrado: caminho terminou em null.`, snapshot: _snapshot(root), memory: _buildMemory(root, null) });
    return { steps, root };
  }

  function _remove(value) {
    const tree = _clone(root);
    const steps = [{ description: `Remover ${value}: primeiro localizar o no na BST.`, snapshot: _snapshot(tree), memory: _buildMemory(tree, null) }];

    let current = tree;
    let removedId = null;
    while (current) {
      steps.push({
        description: `Comparando ${value} com ${current.value}.`,
        snapshot: _snapshot(tree, [current.id], 'visiting'),
        memory: _buildMemory(tree, current.id),
      });
      if (current.value === value) {
        removedId = current.id;
        steps.push({
          description: `No ${current.value} encontrado para remocao.`,
          snapshot: _snapshot(tree, [current.id], 'danger'),
          memory: _buildMemory(tree, current.id),
        });
        break;
      }
      current = value < current.value ? current.left : current.right;
    }

    const nextRoot = removedId == null ? tree : _deleteNode(tree, value);
    steps.push({
      description: removedId == null ? `${value} nao estava na arvore.` : `Remocao de ${value} concluida. Se havia dois filhos, usamos o sucessor em ordem.`,
      snapshot: _snapshot(nextRoot, removedId == null ? [] : [], removedId == null ? 'neutral' : 'success'),
      memory: _buildMemory(nextRoot, null),
    });
    return { steps, root: nextRoot };
  }

  function _deleteNode(node, value) {
    if (!node) return null;
    if (value < node.value) {
      node.left = _deleteNode(node.left, value);
      return node;
    }
    if (value > node.value) {
      node.right = _deleteNode(node.right, value);
      return node;
    }
    if (!node.left) return node.right;
    if (!node.right) return node.left;
    const successor = _minNode(node.right);
    node.value = successor.value;
    node.right = _deleteNode(node.right, successor.value);
    return node;
  }

  function _minNode(node) {
    while (node.left) node = node.left;
    return node;
  }

  function _buildMemory(tree, accessedId) { return _mem.buildMemory(_flatten(tree), accessedId); }

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

  function _size(tree) { return _flatten(tree).length; }
  function _clone(node) {
    if (!node) return null;
    return { id: node.id, value: node.value, left: _clone(node.left), right: _clone(node.right) };
  }
}
