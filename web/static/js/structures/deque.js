/**
 * deque.js — Lógica de simulação do Deque.
 *
 * Estado interno: array de objetos { id, value }
 * nodes[0] = front, nodes[last] = rear.
 * Visualmente, o deque é mostrado como lista duplamente encadeada.
 */

function initStructurePage() {
  let nodes = [];
  let nextId = 0;
  const MAX_SIZE = 30;

  const BYTES_PER_NODE = 24;
  const BASE_ADDR = 0x7000;

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

  selectOp.innerHTML = `
    <optgroup label="Deque">
      <option value="pushFront">Push front (inserir na frente)</option>
      <option value="pushBack">Push back (inserir no fim)</option>
      <option value="popFront">Pop front (remover da frente)</option>
      <option value="popBack">Pop back (remover do fim)</option>
      <option value="peekFront">Peek front</option>
      <option value="peekBack">Peek back</option>
      <option value="search">Buscar por valor</option>
    </optgroup>
  `;

  const fieldMap = {
    pushFront: ['value'],
    pushBack: ['value'],
    popFront: [],
    popBack: [],
    peekFront: [],
    peekBack: [],
    search: ['value'],
  };

  function _syncFields() {
    StructureUI.syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, fieldMap);
  }
  selectOp.addEventListener('change', _syncFields);
  _syncFields();

  StructureUI.initMeta(meta, 'Deque');
  MemoryPanel.init('deque');

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(MAX_SIZE, Math.max(2, parseInt(inputSize.value, 10) || 6));
    nodes = Array.from({ length: size }, () => ({ id: nextId++, value: Math.floor(Math.random() * 90) + 1 }));
    _prevAccessedId = -1;
    Animator.load([{
      description: `Deque gerado com ${size} elementos. front fica à esquerda e rear à direita, ambos acessíveis em O(1).`,
      snapshot: _snapshot(nodes),
      memory: _buildMemory(nodes, null),
    }]);
  });
  btnGenerate.click();

  btnExecute.addEventListener('click', () => {
    const op = selectOp.value;
    if (nodes.length === 0 && op !== 'pushFront' && op !== 'pushBack') {
      alert('O deque está vazio. Insira um novo elemento primeiro.');
      return;
    }

    const value = parseInt(inputValue.value, 10);
    let result = { steps: [] };
    _prevAccessedId = -1;

    switch (op) {
      case 'pushFront':
        result = _pushFront(value);
        break;
      case 'pushBack':
        result = _pushBack(value);
        break;
      case 'popFront':
        result = _popFront();
        break;
      case 'popBack':
        result = _popBack();
        break;
      case 'peekFront':
        result = _peekFront();
        break;
      case 'peekBack':
        result = _peekBack();
        break;
      case 'search':
        result = _search(value);
        break;
    }

    if (result.steps.length > 0) {
      nodes = result.nodes;
      Animator.load(result.steps);
    }
  });

  function _nodeAddr(id) {
    const offset = ((id * 2246822519) >>> 0) % 0x4000;
    const aligned = offset & ~0x17;
    const hex = (BASE_ADDR + aligned).toString(16).toUpperCase();
    return '0x' + hex.padStart(4, '0');
  }

  function _cacheFor(nodeId) {
    const hit = nodeId === _prevAccessedId;
    _prevAccessedId = nodeId;
    if (hit) {
      return { event: 'hit', cycles: 4, note: 'Nó ainda presente no cache L1 — acesso recente.' };
    }
    return {
      event: 'miss',
      cycles: 200,
      note: `Ponteiro leva a ${_nodeAddr(nodeId)} — endereço disperso no heap.`,
    };
  }

  function _buildMemory(nodeList, accessedNodeId, noteOverride = null) {
    const cache = (accessedNodeId != null && accessedNodeId >= 0)
      ? _cacheFor(accessedNodeId)
      : { event: null, cycles: null, note: null };

    return {
      type: 'deque',
      totalBytes: nodeList.length * BYTES_PER_NODE,
      event: cache.event,
      cycles: cache.cycles,
      note: noteOverride || cache.note || 'Deque duplamente encadeado: cada nó guarda next e prev.',
      accessedIdx: accessedNodeId != null ? nodeList.findIndex(node => node.id === accessedNodeId) : null,
      layout: nodeList.map(node => ({ value: node.value, addr: _nodeAddr(node.id) })),
    };
  }

  function _snapshot(list, highlightedIdxs = [], hlState = 'visiting', prependNodes = [], prependState = 'neutral', appendNodes = [], appendState = 'neutral') {
    const allNodes = [
      ...prependNodes.map(node => ({ id: node.id, value: node.value, state: prependState })),
      ...list.map((node, idx) => ({
        id: node.id,
        value: node.value,
        state: highlightedIdxs.includes(idx) ? hlState : 'neutral',
      })),
      ...appendNodes.map(node => ({ id: node.id, value: node.value, state: appendState })),
    ];

    return {
      type: 'deque',
      nodes: allNodes,
      pointers: {
        front: allNodes[0]?.id,
        rear: allNodes[allNodes.length - 1]?.id,
      },
    };
  }

  function _pushFront(val) {
    if (isNaN(val)) {
      alert('Informe um valor.');
      return { steps: [], nodes };
    }
    if (nodes.length >= MAX_SIZE) {
      alert(`O deque suporta no máximo ${MAX_SIZE} elementos.`);
      return { steps: [], nodes };
    }

    const list = nodes.slice();
    const newNode = { id: nextId++, value: val };
    const resultNodes = [newNode, ...list];
    const steps = [];

    steps.push({
      description: `Push front ${val}: criando novo nó para entrar pela frente do deque.`,
      snapshot: _snapshot(list, [], 'neutral', [newNode], 'success'),
      memory: _buildMemory(resultNodes, newNode.id),
    });

    steps.push({
      description: `Passo 2/3: novo nó.next aponta para o antigo front${list[0] ? ` (valor ${list[0].value})` : ' (null)'}. O antigo front, se existir, recebe prev para o novo nó.`,
      snapshot: _snapshot(list, list.length > 0 ? [0] : [], 'visiting', [newNode], 'success'),
      memory: _buildMemory(resultNodes, list[0]?.id ?? newNode.id),
    });

    steps.push({
      description: `Passo 3/3: front atualizado para ${val}. Push front concluído — O(1).`,
      snapshot: _snapshot(resultNodes, [0], 'success'),
      memory: _buildMemory(resultNodes, null),
    });

    return { steps, nodes: resultNodes };
  }

  function _pushBack(val) {
    if (isNaN(val)) {
      alert('Informe um valor.');
      return { steps: [], nodes };
    }
    if (nodes.length >= MAX_SIZE) {
      alert(`O deque suporta no máximo ${MAX_SIZE} elementos.`);
      return { steps: [], nodes };
    }

    const list = nodes.slice();
    const newNode = { id: nextId++, value: val };
    const resultNodes = [...list, newNode];
    const steps = [];

    steps.push({
      description: `Push back ${val}: criando novo nó para entrar pelo fim do deque.`,
      snapshot: _snapshot(list, [], 'neutral', [], 'neutral', [newNode], 'success'),
      memory: _buildMemory(resultNodes, newNode.id),
    });

    steps.push({
      description: `Passo 2/3: novo nó.prev aponta para o antigo rear${list.length > 0 ? ` (valor ${list[list.length - 1].value})` : ' (null)'}. O antigo rear, se existir, recebe next para o novo nó.`,
      snapshot: _snapshot(list, list.length > 0 ? [list.length - 1] : [], 'visiting', [], 'neutral', [newNode], 'success'),
      memory: _buildMemory(resultNodes, list.length > 0 ? list[list.length - 1].id : newNode.id),
    });

    steps.push({
      description: `Passo 3/3: rear atualizado para ${val}. Push back concluído — O(1).`,
      snapshot: _snapshot(resultNodes, [resultNodes.length - 1], 'success'),
      memory: _buildMemory(resultNodes, null),
    });

    return { steps, nodes: resultNodes };
  }

  function _popFront() {
    const list = nodes.slice();
    const removed = list[0];
    const resultNodes = list.slice(1);
    const steps = [];

    steps.push({
      description: `Pop front: removendo o nó da frente com valor ${removed.value}.`,
      snapshot: _snapshot(list, [0], 'danger'),
      memory: _buildMemory(list, removed.id),
    });

    steps.push({
      description: resultNodes.length > 0
        ? `Passo 2/2: front atualizado para ${resultNodes[0].value}; o novo primeiro nó passa a ter prev = null.`
        : 'Passo 2/2: o deque ficou vazio após remover a frente.',
      snapshot: _snapshot(resultNodes, resultNodes.length > 0 ? [0] : [], 'success'),
      memory: _buildMemory(resultNodes, resultNodes[0]?.id ?? null),
    });

    return { steps, nodes: resultNodes };
  }

  function _popBack() {
    const list = nodes.slice();
    const removed = list[list.length - 1];
    const resultNodes = list.slice(0, -1);
    const steps = [];

    steps.push({
      description: `Pop back: removendo o nó do fim com valor ${removed.value}.`,
      snapshot: _snapshot(list, [list.length - 1], 'danger'),
      memory: _buildMemory(list, removed.id),
    });

    steps.push({
      description: resultNodes.length > 0
        ? `Passo 2/2: rear atualizado para ${resultNodes[resultNodes.length - 1].value}; o novo último nó passa a ter next = null.`
        : 'Passo 2/2: o deque ficou vazio após remover o fim.',
      snapshot: _snapshot(resultNodes, resultNodes.length > 0 ? [resultNodes.length - 1] : [], 'success'),
      memory: _buildMemory(resultNodes, resultNodes.length > 0 ? resultNodes[resultNodes.length - 1].id : null),
    });

    return { steps, nodes: resultNodes };
  }

  function _peekFront() {
    const list = nodes.slice();
    const steps = [{
      description: 'Peek front: consultando o primeiro nó sem removê-lo.',
      snapshot: _snapshot(list, [0], 'visiting'),
      memory: _buildMemory(list, list[0].id),
    }, {
      description: `Passo 2/2: front contém ${list[0].value}. O deque não foi alterado — O(1).`,
      snapshot: _snapshot(list, [0], 'success'),
      memory: _buildMemory(list, list[0].id),
    }];

    return { steps, nodes: list };
  }

  function _peekBack() {
    const list = nodes.slice();
    const lastIdx = list.length - 1;
    const steps = [{
      description: 'Peek back: consultando o último nó sem removê-lo.',
      snapshot: _snapshot(list, [lastIdx], 'visiting'),
      memory: _buildMemory(list, list[lastIdx].id),
    }, {
      description: `Passo 2/2: rear contém ${list[lastIdx].value}. O deque não foi alterado — O(1).`,
      snapshot: _snapshot(list, [lastIdx], 'success'),
      memory: _buildMemory(list, list[lastIdx].id),
    }];

    return { steps, nodes: list };
  }

  function _search(val) {
    if (isNaN(val)) {
      alert('Informe um valor.');
      return { steps: [], nodes };
    }

    const list = nodes.slice();
    const steps = [{
      description: `Busca pelo valor ${val}. O deque é percorrido do front para o rear via ponteiros next.`,
      snapshot: _snapshot(list),
      memory: _buildMemory(list, null),
    }];

    for (let i = 0; i < list.length; i++) {
      const found = list[i].value === val;
      steps.push({
        description: `Passo ${i + 1}/${list.length}: nó ${i} contém ${list[i].value}. ${found ? 'ENCONTRADO!' : 'Avançar.'}`,
        snapshot: _snapshot(list, [i], found ? 'success' : 'visiting'),
        memory: _buildMemory(list, list[i].id),
      });
      if (found) {
        return { steps, nodes: list };
      }
    }

    steps.push({
      description: `Valor ${val} não encontrado no deque.`,
      snapshot: _snapshot(list),
      memory: _buildMemory(list, null),
    });
    return { steps, nodes: list };
  }
}
