/**
 * red-black-tree.js
 * Arvore Rubro-Negra com animacoes passo a passo de insercao, busca e remocao.
 *
 * Propriedades mantidas apos cada operacao:
 *  P1 - Todo no e VERMELHO ou PRETO
 *  P2 - A raiz e PRETA
 *  P3 - Todo NIL (folha sentinela) e PRETO
 *  P4 - Filhos de um no VERMELHO sao PRETOS (sem dois vermelhos consecutivos)
 *  P5 - Todo caminho de qualquer no ate seus NIL tem igual numero de nos PRETOS
 *
 * Nos no SVG: VERMELHO -> estado 'danger' (borda vermelha)
 *             PRETO    -> estado 'neutral' (borda cinza)
 */
function initStructurePage() {
  let root = null;
  let nextId = 0;
  const MAX_SIZE = 20;
  const BYTES_PER_NODE = 32; // value(4) + color(1+3pad) + left*(8) + right*(8) + parent*(8)

  // ── UI ────────────────────────────────────────────────────────────────
  const { btnGenerate, btnExecute, inputSize, inputValue, selectOp } = StructureUI.bootstrap({
    fallbackName: 'Arvore Rubro-Negra',
    memoryType:   'tree',
    maxSize:      15,
    fieldMap:     { insert: ['value'], search: ['value'], remove: ['value'] },
    selectHtml: `
      <optgroup label="Rubro-Negra">
        <option value="insert">Inserir</option>
        <option value="search">Buscar</option>
        <option value="remove">Remover</option>
      </optgroup>
    `,
  });

  // ── Memory ────────────────────────────────────────────────────────────
  const _memHelper = MemoryHelpers.forLinked({
    type: 'tree', bytesPerNode: BYTES_PER_NODE, baseAddr: 0xC000,
    hashMult: 2246822519, rangeSize: 0x5000, alignMask: ~0xF,
    idleNote: `Cada no: valor(4B) + cor(1+3B pad) + 3 ponteiros(24B) = ${BYTES_PER_NODE}B.`,
    missNote: addr => `Acesso ao no em ${addr}.`,
  });

  // ── Estrutura interna do no ─────────────────────────────────────────────
  // { id, value, color:'RED'|'BLACK', left, right, parent }

  function _newNode(v) {
    return { id: nextId++, value: v, color: 'RED', left: null, right: null, parent: null };
  }

  function _isRed(n)    { return n !== null && n.color === 'RED'; }
  function _colorOf(n)  { return n ? n.color : 'BLACK'; }

  // ── Rotacoes (mutam root diretamente na closure) ────────────────────────

  function _rotateLeft(x) {
    const y  = x.right;
    x.right  = y.left;
    if (y.left) y.left.parent = x;
    y.parent = x.parent;
    if      (!x.parent)           root = y;
    else if (x === x.parent.left) x.parent.left  = y;
    else                           x.parent.right = y;
    y.left    = x;
    x.parent  = y;
  }

  function _rotateRight(x) {
    const y   = x.left;
    x.left    = y.right;
    if (y.right) y.right.parent = x;
    y.parent  = x.parent;
    if      (!x.parent)            root = y;
    else if (x === x.parent.right) x.parent.right = y;
    else                            x.parent.left  = y;
    y.right   = x;
    x.parent  = y;
  }

  // Substitui a subarvore enraizada em u pela de v.
  function _transplant(u, v) {
    if      (!u.parent)           root = v;
    else if (u === u.parent.left) u.parent.left  = v;
    else                           u.parent.right = v;
    if (v) v.parent = u.parent;
  }

  // ── INSERIR ─────────────────────────────────────────────────────────────

  function _insertOp(value) {
    if (_size() >= MAX_SIZE) {
      alert(`A arvore suporta no maximo ${MAX_SIZE} nos.`);
      return { steps: [], root };
    }

    const steps = [];
    steps.push({
      description: `Inserir ${value}: percorrer a arvore como BST, criar no VERMELHO, depois corrigir violacoes das propriedades P4 e P2.`,
      snapshot: _snap(),
      memory:   _mem(null),
    });

    // ── 1. Insercao BST padrao ────────────────────────────────────────────
    const z = _newNode(value);
    let cur = root;
    let par = null;

    while (cur) {
      steps.push({
        description: `Passo: comparando ${value} com ${cur.value}. ${
          value < cur.value  ? `${value} < ${cur.value} → descer para a esquerda.` :
          value > cur.value  ? `${value} > ${cur.value} → descer para a direita.`  :
                               `Valor duplicado — ignorar.`}`,
        snapshot: _snap([cur.id], 'visiting'),
        memory:   _mem(cur.id),
      });
      if (value === cur.value) { nextId--; return { steps, root }; }
      par = cur;
      cur = value < cur.value ? cur.left : cur.right;
    }

    z.parent = par;
    if      (!par)                 root      = z;
    else if (value < par.value)    par.left  = z;
    else                           par.right = z;

    steps.push({
      description: `No ${value} inserido como VERMELHO${par ? ` filho de ${par.value}` : ' (raiz vazia)'}. Verificar P4: pai deve ser PRETO.`,
      snapshot: _snap([z.id], 'warning'),
      memory:   _mem(z.id),
    });

    // ── 2. Corrigir violacoes ─────────────────────────────────────────────
    _fixInsert(z, steps);

    steps.push({
      description: `Insercao de ${value} concluida. Todas as propriedades Rubro-Negra estao satisfeitas. Altura da arvore: ${_treeHeight(root)}.`,
      snapshot: _snap(),
      memory:   _mem(null),
    });

    return { steps, root };
  }

  function _fixInsert(z, steps) {
    while (_isRed(z.parent)) {
      const p  = z.parent;
      const g  = p.parent; // avo garantido (raiz e sempre preta)

      if (p === g.left) {
        const u = g.right; // tio

        if (_isRed(u)) {
          // ── Caso 1: tio VERMELHO — recolorir e subir ──────────────────
          steps.push?.({
            description: `Caso 1 — Tio ${u.value} e VERMELHO. ` +
              `Recolorir: pai ${p.value} → PRETO, tio ${u.value} → PRETO, avo ${g.value} → VERMELHO. ` +
              `Subir o problema para o avo (P4 pode violar acima).`,
            snapshot: _snap([p.id, u.id, g.id], 'warning'),
            memory:   _mem(g.id),
          });
          p.color = 'BLACK';
          u.color = 'BLACK';
          g.color = 'RED';
          z = g;

        } else {
          if (z === p.right) {
            // ── Caso 2: tio PRETO, no e filho DIREITO (zigzag) ───────────
            steps.push?.({
              description: `Caso 2 — Tio PRETO, no ${z.value} e filho DIREITO (zigzag). ` +
                `Rotacao esquerda em pai ${p.value} para converter em Caso 3 (linha reta).`,
              snapshot: _snap([z.id, p.id], 'warning'),
              memory:   _mem(p.id),
            });
            z = p;
            _rotateLeft(z);
          }
          // ── Caso 3: tio PRETO, no e filho ESQUERDO (linha reta) ──────
          steps.push?.({
            description: `Caso 3 — Tio PRETO, no ${z.value} e filho ESQUERDO (linha reta). ` +
              `Recolorir pai ${z.parent.value} → PRETO, avo ${z.parent.parent.value} → VERMELHO. ` +
              `Rotacao direita no avo para colocar o pai no topo.`,
            snapshot: _snap([z.id, z.parent.id, z.parent.parent.id], 'warning'),
            memory:   _mem(z.parent.id),
          });
          z.parent.color         = 'BLACK';
          z.parent.parent.color  = 'RED';
          _rotateRight(z.parent.parent);
        }

      } else {
        // Casos espelho (pai e filho DIREITO do avo)
        const u = g.left;

        if (_isRed(u)) {
          steps.push?.({
            description: `Caso 1 (espelho) — Tio ${u.value} e VERMELHO. ` +
              `Recolorir: pai ${p.value} → PRETO, tio ${u.value} → PRETO, avo ${g.value} → VERMELHO. Subir para avo.`,
            snapshot: _snap([p.id, u.id, g.id], 'warning'),
            memory:   _mem(g.id),
          });
          p.color = 'BLACK';
          u.color = 'BLACK';
          g.color = 'RED';
          z = g;

        } else {
          if (z === p.left) {
            steps.push?.({
              description: `Caso 2 (espelho) — Tio PRETO, no ${z.value} e filho ESQUERDO (zigzag). ` +
                `Rotacao direita em pai ${p.value} para converter em Caso 3.`,
              snapshot: _snap([z.id, p.id], 'warning'),
              memory:   _mem(p.id),
            });
            z = p;
            _rotateRight(z);
          }
          steps.push?.({
            description: `Caso 3 (espelho) — Tio PRETO, no ${z.value} e filho DIREITO (linha reta). ` +
              `Recolorir pai ${z.parent.value} → PRETO, avo ${z.parent.parent.value} → VERMELHO. ` +
              `Rotacao esquerda no avo.`,
            snapshot: _snap([z.id, z.parent.id, z.parent.parent.id], 'warning'),
            memory:   _mem(z.parent.id),
          });
          z.parent.color         = 'BLACK';
          z.parent.parent.color  = 'RED';
          _rotateLeft(z.parent.parent);
        }
      }
    }

    if (root && root.color !== 'BLACK') {
      steps.push?.({
        description: `P2 — Raiz ${root.value} colorida de PRETO (a raiz deve ser sempre PRETA).`,
        snapshot: _snap([root.id], 'visiting'),
        memory:   _mem(root.id),
      });
    }
    if (root) root.color = 'BLACK';
  }

  // ── BUSCAR ──────────────────────────────────────────────────────────────

  function _searchOp(value) {
    const steps = [];
    steps.push({
      description: `Buscar ${value}: percurso O(log n) — altura balanceada pelas propriedades Rubro-Negra.`,
      snapshot: _snap(),
      memory:   _mem(null),
    });

    let cur = root;
    while (cur) {
      const found = cur.value === value;
      const cor   = cur.color === 'RED' ? 'VERMELHO' : 'PRETO';
      steps.push({
        description: `Visitando ${cur.value} [${cor}]. ${
          found               ? `ENCONTRADO! Busca concluida em O(log n).`         :
          value < cur.value   ? `${value} < ${cur.value} → ir para subarvore esquerda.`  :
                                `${value} > ${cur.value} → ir para subarvore direita.`}`,
        snapshot: _snap([cur.id], found ? 'success' : 'visiting'),
        memory:   _mem(cur.id),
      });
      if (found) return { steps, root };
      cur = value < cur.value ? cur.left : cur.right;
    }

    steps.push({
      description: `${value} nao encontrado — chegamos ao NIL PRETO (sentinela de folha).`,
      snapshot: _snap(),
      memory:   _mem(null),
    });
    return { steps, root };
  }

  // ── REMOVER ─────────────────────────────────────────────────────────────

  function _removeOp(value) {
    const steps = [];
    steps.push({
      description: `Remover ${value}: localizar o no, substituir pelo sucessor in-order se necessario, depois corrigir altura-preta (P5) se o no removido era PRETO.`,
      snapshot: _snap(),
      memory:   _mem(null),
    });

    // 1. Localizar no z
    let z = root;
    while (z && z.value !== value) {
      steps.push({
        description: `Comparando ${value} com ${z.value}. ${value < z.value ? 'Ir para esquerda.' : 'Ir para direita.'}`,
        snapshot: _snap([z.id], 'visiting'),
        memory:   _mem(z.id),
      });
      z = value < z.value ? z.left : z.right;
    }

    if (!z) {
      steps.push({
        description: `${value} nao encontrado na arvore.`,
        snapshot: _snap(),
        memory:   _mem(null),
      });
      return { steps, root };
    }

    steps.push({
      description: `No ${value} [${z.color === 'RED' ? 'VERMELHO' : 'PRETO'}] encontrado. Iniciar remocao.`,
      snapshot: _snap([z.id], 'danger'),
      memory:   _mem(z.id),
    });

    // 2. Remocao BST
    let y = z;
    let yOrigColor = y.color;
    let x, xParent, xIsLeft;

    if (!z.left) {
      x       = z.right;
      xParent = z.parent;
      xIsLeft = !z.parent ? true : (z === z.parent.left);
      steps.push({
        description: `No ${z.value} nao tem filho esquerdo. Substituir diretamente pelo filho direito${x ? ` (${x.value})` : ' (NIL)'}.`,
        snapshot: _snap([z.id], 'danger'),
        memory:   _mem(z.id),
      });
      _transplant(z, z.right);

    } else if (!z.right) {
      x       = z.left;
      xParent = z.parent;
      xIsLeft = !z.parent ? true : (z === z.parent.left);
      steps.push({
        description: `No ${z.value} nao tem filho direito. Substituir pelo filho esquerdo (${x.value}).`,
        snapshot: _snap([z.id], 'danger'),
        memory:   _mem(z.id),
      });
      _transplant(z, z.left);

    } else {
      // No com dois filhos: usar sucessor in-order (minimo da subarvore direita)
      y = z.right;
      while (y.left) y = y.left;
      yOrigColor = y.color;
      x = y.right;

      steps.push({
        description: `No ${z.value} tem dois filhos. Sucessor in-order: ${y.value} [${y.color === 'RED' ? 'VERMELHO' : 'PRETO'}] — menor valor da subarvore direita. Seu valor substituira ${z.value}.`,
        snapshot: _snap([z.id, y.id], 'warning'),
        memory:   _mem(y.id),
      });

      if (y.parent === z) {
        xParent = y;
        xIsLeft = false; // x e filho direito de y
      } else {
        xParent = y.parent;
        xIsLeft = true;  // y era filho esquerdo do seu pai (era o minimo)
        _transplant(y, y.right);
        y.right        = z.right;
        y.right.parent = y;
      }
      _transplant(z, y);
      y.left         = z.left;
      y.left.parent  = y;
      y.color        = z.color;

      steps.push({
        description: `Valor ${y.value} movido para a posicao de ${z.value}, herdando sua cor [${y.color === 'RED' ? 'VERMELHO' : 'PRETO'}]. O no fisico do sucessor foi desligado.`,
        snapshot: _snap([y.id], 'visiting'),
        memory:   _mem(y.id),
      });
    }

    // 3. Corrigir altura-preta se o no removido era PRETO
    if (yOrigColor === 'BLACK') {
      steps.push({
        description: `No removido era PRETO — violamos P5 (altura-preta). ` +
          `O filho substituto${x ? ` ${x.value}` : ' NIL'} recebe um "PRETO extra" (duplo-preto). ` +
          `Executar fixDelete para redistribuir essa negridao.`,
        snapshot: x ? _snap([x.id], 'warning') : _snap(),
        memory:   _mem(x ? x.id : null),
      });
      _fixDelete(x, xParent, xIsLeft, steps);
    } else {
      steps.push({
        description: `No removido era VERMELHO — P5 preservado (altura-preta nao muda). Nenhuma correcao necessaria.`,
        snapshot: _snap(),
        memory:   _mem(null),
      });
    }

    steps.push({
      description: `Remocao de ${value} concluida. Altura da arvore: ${_treeHeight(root)}. Propriedades P1-P5 restauradas.`,
      snapshot: _snap(),
      memory:   _mem(null),
    });

    return { steps, root };
  }

  function _fixDelete(x, xParent, xIsLeft, steps) {
    while (x !== root && _colorOf(x) === 'BLACK') {
      if (!xParent) break; // x e a raiz

      if (xIsLeft) {
        let w = xParent.right; // irmao de x

        if (!w) {
          // Arvore invalida — subir defensivamente
          x = xParent; xParent = x.parent;
          xIsLeft = xParent ? (x === xParent.left) : true;
          continue;
        }

        if (_isRed(w)) {
          // ── Fix Caso 1: irmao VERMELHO ────────────────────────────────
          steps.push?.({
            description: `Fix Caso 1 — Irmao ${w.value} e VERMELHO. ` +
              `Recolorir irmao → PRETO, pai ${xParent.value} → VERMELHO. ` +
              `Rotacao esquerda no pai. O novo irmao sera PRETO e entramos nos casos 2-4.`,
            snapshot: _snap([w.id, xParent.id], 'warning'),
            memory:   _mem(w.id),
          });
          w.color       = 'BLACK';
          xParent.color = 'RED';
          _rotateLeft(xParent);
          w = xParent.right;
        }

        if (_colorOf(w.left) === 'BLACK' && _colorOf(w.right) === 'BLACK') {
          // ── Fix Caso 2: irmao PRETO, ambos filhos PRETOS ─────────────
          steps.push?.({
            description: `Fix Caso 2 — Irmao ${w.value} PRETO com filhos PRETOS. ` +
              `Recolorir irmao → VERMELHO para absorver o duplo-preto. ` +
              `Subir o duplo-preto para o pai ${xParent.value}.`,
            snapshot: _snap([w.id, xParent.id], 'warning'),
            memory:   _mem(w.id),
          });
          w.color = 'RED';
          x       = xParent;
          xParent = x.parent;
          xIsLeft = xParent ? (x === xParent.left) : true;

        } else {
          if (_colorOf(w.right) === 'BLACK') {
            // ── Fix Caso 3: irmao PRETO, filho DIREITO preto, esquerdo vermelho ─
            steps.push?.({
              description: `Fix Caso 3 — Irmao ${w.value} PRETO, filho direito PRETO, filho esquerdo VERMELHO. ` +
                `Recolorir filho esquerdo → PRETO, irmao → VERMELHO. ` +
                `Rotacao direita no irmao para criar o Caso 4.`,
              snapshot: _snap([w.id, w.left ? w.left.id : null].filter(Boolean), 'warning'),
              memory:   _mem(w.id),
            });
            if (w.left) w.left.color = 'BLACK';
            w.color = 'RED';
            _rotateRight(w);
            w = xParent.right;
          }
          // ── Fix Caso 4: irmao PRETO, filho DIREITO vermelho ──────────
          steps.push?.({
            description: `Fix Caso 4 — Irmao ${w.value} PRETO, filho direito VERMELHO. ` +
              `Irmao herda a cor do pai; pai → PRETO; filho direito do irmao → PRETO. ` +
              `Rotacao esquerda no pai. Duplo-preto RESOLVIDO!`,
            snapshot: _snap([w.id, xParent.id, w.right ? w.right.id : null].filter(Boolean), 'success'),
            memory:   _mem(w.id),
          });
          w.color       = xParent.color;
          xParent.color = 'BLACK';
          if (w.right) w.right.color = 'BLACK';
          _rotateLeft(xParent);
          x = root; // encerrar o loop
        }

      } else {
        // Casos espelho (x e filho DIREITO)
        let w = xParent.left;

        if (!w) {
          x = xParent; xParent = x.parent;
          xIsLeft = xParent ? (x === xParent.left) : true;
          continue;
        }

        if (_isRed(w)) {
          steps.push?.({
            description: `Fix Caso 1 (espelho) — Irmao ${w.value} e VERMELHO. ` +
              `Recolorir irmao → PRETO, pai ${xParent.value} → VERMELHO. Rotacao direita no pai.`,
            snapshot: _snap([w.id, xParent.id], 'warning'),
            memory:   _mem(w.id),
          });
          w.color       = 'BLACK';
          xParent.color = 'RED';
          _rotateRight(xParent);
          w = xParent.left;
        }

        if (_colorOf(w.right) === 'BLACK' && _colorOf(w.left) === 'BLACK') {
          steps.push?.({
            description: `Fix Caso 2 (espelho) — Irmao ${w.value} PRETO com filhos PRETOS. ` +
              `Recolorir irmao → VERMELHO. Subir duplo-preto para pai ${xParent.value}.`,
            snapshot: _snap([w.id, xParent.id], 'warning'),
            memory:   _mem(w.id),
          });
          w.color = 'RED';
          x       = xParent;
          xParent = x.parent;
          xIsLeft = xParent ? (x === xParent.left) : true;

        } else {
          if (_colorOf(w.left) === 'BLACK') {
            steps.push?.({
              description: `Fix Caso 3 (espelho) — Irmao ${w.value} PRETO, filho esquerdo PRETO, filho direito VERMELHO. ` +
                `Recolorir filho direito → PRETO, irmao → VERMELHO. Rotacao esquerda no irmao.`,
              snapshot: _snap([w.id, w.right ? w.right.id : null].filter(Boolean), 'warning'),
              memory:   _mem(w.id),
            });
            if (w.right) w.right.color = 'BLACK';
            w.color = 'RED';
            _rotateLeft(w);
            w = xParent.left;
          }
          steps.push?.({
            description: `Fix Caso 4 (espelho) — Irmao ${w.value} PRETO, filho esquerdo VERMELHO. ` +
              `Irmao herda cor do pai; pai → PRETO; filho esquerdo do irmao → PRETO. ` +
              `Rotacao direita no pai. Duplo-preto RESOLVIDO!`,
            snapshot: _snap([w.id, xParent.id, w.left ? w.left.id : null].filter(Boolean), 'success'),
            memory:   _mem(w.id),
          });
          w.color       = xParent.color;
          xParent.color = 'BLACK';
          if (w.left) w.left.color = 'BLACK';
          _rotateRight(xParent);
          x = root;
        }
      }
    }
    if (x) x.color = 'BLACK';
  }

  // ── Snapshot ────────────────────────────────────────────────────────────

  function _snap(highlighted = [], hlState = 'visiting') {
    const nodes = [];
    let order = 0;
    function walk(node, depth, parentId) {
      if (!node) return;
      walk(node.left, depth + 1, node.id);
      const isHl = highlighted.includes(node.id);
      nodes.push({
        id:      node.id,
        value:   node.value,
        state:   isHl ? hlState : 'neutral',
        rbColor: node.color,
        parent:  parentId,
        depth,
        order:   order++,
        meta:    node.color === 'RED' ? 'R' : 'B',
      });
      walk(node.right, depth + 1, node.id);
    }
    walk(root, 0, null);
    nodes.sort((a, b) => a.depth - b.depth || a.order - b.order);
    const h  = _treeHeight(root);
    const bh = _blackHeight(root);
    const lbl = root ? `root  h=${h}  bh=${bh}` : 'root';
    return { type: 'tree', nodes, rootLabel: lbl };
  }

  function _mem(accessedId) { return _memHelper.buildMemory(_flatten(), accessedId); }

  // ── Auxiliares ──────────────────────────────────────────────────────────

  function _flatten() {
    const out = [];
    (function w(n) { if (!n) return; out.push(n); w(n.left); w(n.right); })(root);
    return out;
  }

  function _size() { return _flatten().length; }

  function _treeHeight(node) {
    if (!node) return 0;
    return 1 + Math.max(_treeHeight(node.left), _treeHeight(node.right));
  }

  // Altura-preta: contagem de nos PRETOS do no ate NIL (nao conta NIL, conta o proprio no se preto)
  function _blackHeight(node) {
    let count = 0, cur = node;
    while (cur) { if (cur.color === 'BLACK') count++; cur = cur.left; }
    return count;
  }

  // Inserir sem gerar steps (para geracao inicial)
  function _insertSilent(v) {
    const z = _newNode(v);
    let cur = root, par = null;
    while (cur) {
      par = cur;
      if (v === cur.value) { nextId--; return; }
      cur = v < cur.value ? cur.left : cur.right;
    }
    z.parent = par;
    if      (!par)           root      = z;
    else if (v < par.value)  par.left  = z;
    else                     par.right = z;
    _fixInsert(z, []); // descarta steps
  }

  // ── Gerar arvore inicial ────────────────────────────────────────────────

  btnGenerate.addEventListener('click', () => {
    const size = Math.min(15, Math.max(2, parseInt(inputSize.value, 10) || 8));
    root    = null;
    nextId  = 0;
    _memHelper.reset();

    const vals = [];
    while (vals.length < size) {
      const v = Math.floor(Math.random() * 90) + 1;
      if (!vals.includes(v)) vals.push(v);
    }
    vals.forEach(_insertSilent);

    Animator.load([{
      description: `Arvore Rubro-Negra gerada com ${size} nos. ` +
        `Nos VERMELHOS (R) em borda vermelha, PRETOS (B) em borda cinza. ` +
        `Altura h=${_treeHeight(root)}, altura-preta bh=${_blackHeight(root)}.`,
      snapshot: _snap(),
      memory:   _mem(null),
    }]);
  });
  btnGenerate.click();

  // ── Executar operacao ───────────────────────────────────────────────────

  btnExecute.addEventListener('click', () => {
    const value = parseInt(inputValue.value, 10);
    if (isNaN(value)) { alert('Informe um valor.'); return; }
    _memHelper.reset();
    let result = { steps: [], root };
    switch (selectOp.value) {
      case 'insert': result = _insertOp(value); break;
      case 'search': result = _searchOp(value); break;
      case 'remove': result = _removeOp(value); break;
    }
    if (result.steps.length > 0) {
      root = result.root;
      Animator.load(result.steps);
    }
  });
}
