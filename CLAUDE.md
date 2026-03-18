# ds-explorer — Guia para Desenvolvimento Guiado por IA

Este documento orienta qualquer agente de IA (ou desenvolvedor) que trabalhe neste repositório.
Ele descreve os padrões estabelecidos, convenções de implementação, checklist de segurança e
regras de qualidade que **devem** ser seguidos em toda contribuição.

---

## 1. Visão Geral do Projeto

**ds-explorer** é uma aplicação educacional interativa que visualiza estruturas de dados com
animações passo a passo e simulação de memória. Não há autenticação, banco de dados, nem dados
de usuário — é conteúdo estático educacional servido por um servidor Go.

**Stack:**
- Backend: Go 1.22+ (`net/http` padrão, sem frameworks externos)
- Frontend: JavaScript vanilla (ES6+, sem bundler, sem frameworks)
- Templates: `html/template` do Go
- Conteúdo: arquivos JSON em `content/structures/`

---

## 2. Estrutura do Projeto

```
cmd/server/          # Package main — servidor HTTP
  main.go            # Handlers HTTP, middleware, main()
  registry.go        # Registro de estruturas, isKnownID, loadStructureJSON
  templates.go       # Carregamento e renderização de templates Go
  livereload.go      # Watcher de arquivos para dev (DS_DEV_LIVE_RELOAD=1)

web/
  templates/
    base.html        # Layout base (nav, head, scripts de dev)
    structure.html   # Template da página de estrutura (único para todas)
    home.html        # Página inicial com cards
    compare.html     # Página de comparação
    big_o.html       # Página de referência Big-O
    memory_hierarchy.html
    references.html
  static/
    js/
      core/
        renderer.js      # Renderização SVG — NÃO tocar sem ler toda a lógica
        animator.js      # Controles prev/next/play + log de passos
        memory-panel.js  # Painel de simulação de memória
        structure-ui.js  # Utilitários compartilhados de UI (StructureUI)
      structures/
        array.js         # Lógica de simulação do Array Estático
        list.js          # Lista Dinâmica
        singly.js        # Lista Encadeada Simples
        doubly.js        # Lista Encadeada Dupla
        circular-list.js # Lista Circular
    css/

content/structures/  # Metadados JSON de cada estrutura disponível
  array.json
  dynamic-list.json
  singly-linked-list.json
  doubly-linked-list.json
  circular-list.json
```

---

## 3. Como Adicionar uma Nova Estrutura de Dados

Siga os 6 passos abaixo **na ordem**. Cada passo é independente e pode ser commitado separadamente.

### Passo 1 — Adicionar ao registro (`registry.go`)

Adicione uma entrada ao slice `registry` em `cmd/server/registry.go`:

```go
{
    ID:              "stack",
    Name:            "Pilha (Stack)",
    EnglishName:     "Stack",
    Category:        "Linear",
    Subtype:         "Restrita",
    DotNetName:      "Stack<T>",
    Implementation:  "coleção LIFO",
    Description:     "Estrutura em que o último item inserido é o primeiro a sair.",
    UseCases:        "Adequada para undo, chamadas de função e backtracking.",
    Tradeoffs:       "Acesso restrito ao topo.",
    ReferenceURL:    "https://www.nist.gov/dads/HTML/stack.html",
    ReferenceSource: "NIST DADS",
    SearchBig0:      "O(n)",
    InsertBig0:      "O(1)",
    UpdateBig0:      "O(n)",
    Available:       true,   // false enquanto não implementado
},
```

> **Regra:** `ID` deve ser kebab-case, único, sem caracteres especiais.
> `loadStructureJSON` usa `isKnownID()` como allowlist — o ID é a única chave de acesso.

### Passo 2 — Criar o arquivo JSON de conteúdo

Crie `content/structures/{id}.json` seguindo o schema:

```json
{
  "id": "stack",
  "name": "Pilha (Stack)",
  "category": "Linear",
  "description": "Descrição completa para a página de detalhes.",
  "complexity": {
    "access":       { "best": "O(1)", "average": "O(1)", "worst": "O(1)" },
    "search":       { "best": "O(1)", "average": "O(n)", "worst": "O(n)" },
    "insertBegin":  { "best": "O(1)", "average": "O(1)", "worst": "O(1)" },
    "insertEnd":    { "best": "O(1)", "average": "O(1)", "worst": "O(1)" },
    "insertMiddle": { "best": "O(n)", "average": "O(n)", "worst": "O(n)" },
    "delete":       { "best": "O(1)", "average": "O(1)", "worst": "O(1)" },
    "space":        "O(n)"
  },
  "useCases": {
    "recommended":       ["caso 1", "caso 2"],
    "notRecommended":    ["evitar quando 1"],
    "realWorldExamples": ["exemplo real 1", "exemplo real 2"]
  },
  "codeSnippets": {
    "csharp":     "// código C#",
    "go":         "// código Go",
    "python":     "# código Python",
    "javascript": "// código JavaScript"
  }
}
```

> Campos de `complexity` não obrigatórios podem ser omitidos — `populateComplexity` filtra `null`.

### Passo 3 — Criar o arquivo JavaScript da estrutura

Crie `web/static/js/structures/{jsFile}.js`. O ponto de entrada é sempre `initStructurePage()`:

```javascript
function initStructurePage() {
  // ── State ──────────────────────────────────────────────────────────────
  let data = [];  // estado atual da estrutura

  // ── Constantes de memória ──────────────────────────────────────────────
  const BYTES_PER_NODE = 8;   // ajuste para a estrutura
  const BASE_ADDR      = 0x2000;

  // ── UI refs ────────────────────────────────────────────────────────────
  const meta        = window.__STRUCTURE_DATA__;
  const selectOp    = document.getElementById('select-operation');
  const inputSize   = document.getElementById('input-size');
  const btnGenerate = document.getElementById('btn-generate');
  const btnExecute  = document.getElementById('btn-execute');
  const fieldValue  = document.getElementById('field-value');
  const fieldIndex  = document.getElementById('field-index');
  const fieldNewVal = document.getElementById('field-new-value');

  // ── Field map ──────────────────────────────────────────────────────────
  // Use DEFAULT_FIELD_MAP ou sobrescreva apenas o necessário
  const fieldMap = StructureUI.DEFAULT_FIELD_MAP;
  // Para operações customizadas (ex: push/pop):
  // const fieldMap = { ...StructureUI.DEFAULT_FIELD_MAP, push: ['value'], pop: [] };

  function _syncFields() {
    StructureUI.syncFields(selectOp, fieldValue, fieldIndex, fieldNewVal, fieldMap);
  }
  selectOp.addEventListener('change', _syncFields);
  _syncFields();

  // ── Metadata ───────────────────────────────────────────────────────────
  StructureUI.initMeta(meta, 'NomeFallback');
  MemoryPanel.init('linked'); // 'array' ou 'linked'

  // ── Generate ───────────────────────────────────────────────────────────
  btnGenerate.addEventListener('click', () => {
    // popular `data`, chamar Animator.load([{ description, snapshot, memory }])
  });
  btnGenerate.click();

  // ── Execute ────────────────────────────────────────────────────────────
  btnExecute.addEventListener('click', () => {
    const op    = selectOp.value;
    const value = parseInt(document.getElementById('input-value').value);
    // ... gerar steps e chamar Animator.load(steps)
  });

  // ── Helpers privados (prefixo _) ───────────────────────────────────────
  function _snapshot(nodes, pointers) { ... }
  function _buildMemory(nodes, accessedId) { ... }
}
```

#### Formato do Snapshot

```javascript
// Array:
{ type: 'array', nodes: [{ id: 0, value: 42, state: 'neutral' }] }

// Listas encadeadas (singly / doubly / circular):
{
  type: 'singly',  // ou 'doubly' | 'circular'
  nodes: [{ id: 'n0', value: 42, state: 'neutral' }],
  pointers: { HEAD: 'n0', TAIL: 'n4' }  // TAIL apenas em doubly
}
```

**Estados válidos dos nós:** `'neutral'` | `'visiting'` | `'success'` | `'danger'` | `'warning'`

#### Formato do Step

```javascript
{
  description: 'Passo 1/5: Comparando valor 42 na posição 0.',
  snapshot: { type, nodes, pointers },
  memory: {
    type:        'array',         // ou 'linked'
    totalBytes:  20,
    event:       'hit',           // 'hit' | 'miss' | null
    cycles:      4,               // número estimado de ciclos de CPU
    note:        'Texto explicativo do evento de cache.',
    accessedIdx: 0,               // índice acessado (array) ou null
    layout:      [{ value, addr }] // blocos exibidos no painel de memória
  }
}
```

> **Descrições:** Use a função `_hl()` do animator automaticamente — ela faz syntax highlight
> de números, endereços hex, palavras-chave (`head`, `null`, etc.) e setas (`→`, `←`).
> Escreva as descrições em português. Inclua o padrão `Passo N/Total:` para operações com múltiplos passos.

### Passo 4 — Mapear o ID no template

Em `web/templates/structure.html`, adicione o mapeamento no objeto `jsMap`:

```javascript
const jsMap = {
  'array':              'array',
  'dynamic-list':       'list',
  'singly-linked-list': 'singly',
  'doubly-linked-list': 'doubly',
  'circular-list':      'circular-list',
  'stack':              'stack',   // NOVO
};
```

> **Nunca** use fallback `|| id` — o guard `if (!jsFile) { return; }` já está no lugar
> para falhar silenciosamente com `console.warn`.

### Passo 5 — Adicionar estratégia no Renderer (se novo tipo SVG)

Se a estrutura introduz um novo tipo visual (não é `array`, `singly`, `doubly` ou `circular`),
adicione uma entrada ao objeto `_typeStrategies` em `web/static/js/core/renderer.js`:

```javascript
const _typeStrategies = {
  // ... entradas existentes ...
  stack: {
    drawArrows:    null,  // ou função para desenhar setas
    typeLabel:     () => ({ text: 'T*', x: 4, y: 9 }),
    showIndex:     false,
    pointerLabels: ['top'],
  },
};
```

> **OCP:** adicionar uma entrada aqui é tudo que é necessário. Nenhuma outra função do
> `renderer.js` precisa ser modificada.

### Passo 6 — Verificar

```bash
go build ./cmd/server/
# Subir o servidor e testar manualmente:
#   - Geração de estrutura inicial
#   - Todas as operações disponíveis
#   - Animação prev/next/play
#   - Painel de memória exibe evento de cache correto
#   - Tabela Big-O e snippets de código carregam
#   - GET /api/structure/{id} retorna JSON correto
#   - GET /api/structure/../../etc/passwd retorna 404
```

---

## 4. Convenções Go (Backend)

### Organização de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `main.go` | `main()`, `serverAddr()`, `securityHeaders()`, handlers HTTP |
| `registry.go` | `Structure` struct, `registry` slice, `isKnownID()`, `loadStructureJSON()` |
| `templates.go` | Carregamento/parse de templates, `renderPage()`, `renderJSON()`, `assetURL()`, mapas de complexidade |
| `livereload.go` | Watcher de arquivos dev (`DS_DEV_LIVE_RELOAD=1`) |

**Regra SRP:** cada arquivo tem uma única razão para mudar. Não misture responsabilidades.

### Padrões específicos

```go
// ✅ CORRETO — validação via allowlist antes de qualquer I/O
func loadStructureJSON(id string) ([]byte, error) {
    if !isKnownID(id) {
        return nil, fmt.Errorf("unknown structure id")
    }
    path := filepath.Join("content", "structures", id+".json")
    return os.ReadFile(path)
}

// ❌ ERRADO — sanitização fraca, sujeita a bypass
func loadStructureJSON(id string) ([]byte, error) {
    id = filepath.Base(strings.ReplaceAll(id, "..", ""))
    path := filepath.Join("content", "structures", id+".json")
    return os.ReadFile(path)
}
```

```go
// ✅ CORRETO — erros internos não chegam ao cliente
func renderPage(w http.ResponseWriter, page string, data any) {
    tmpl, err := getTemplate(page)
    if err != nil {
        log.Printf("renderPage: getTemplate(%s): %v", page, err)
        http.Error(w, "internal server error", http.StatusInternalServerError)
        return
    }
    // ...
}
```

```go
// ✅ CORRETO — OCP via map, sem switch/case para crescimento
var complexityClassMap = map[string]string{
    "O(1)":     "card-complexity--excellent",
    "O(log n)": "card-complexity--excellent",
    "O(n)":     "card-complexity--good",
    // adicionar nova complexidade aqui sem tocar em nenhuma função
}
```

### Imports

- Use `"fmt"`, `"os"`, `"path/filepath"`, `"log"`, `"net/http"` — sem dependências externas.
- Remova imports não utilizados. O compilador Go rejeita, mas o linter também deve passar.

---

## 5. Convenções JavaScript (Frontend)

### Padrão IIFE para módulos

Todos os módulos core usam o padrão IIFE:

```javascript
const ModuleName = (() => {
  // Estado privado
  let _state = null;

  // Funções privadas com prefixo _
  function _privateHelper() { ... }

  // API pública
  return { publicMethod };
})();
```

**Regras:**
- Funções e variáveis privadas usam prefixo `_`
- Nunca polua o escopo global além do nome do módulo
- Módulos disponíveis globalmente: `Renderer`, `Animator`, `MemoryPanel`, `StructureUI`

### Arquivos de estrutura

Cada arquivo de estrutura (`web/static/js/structures/*.js`) expõe apenas `initStructurePage()`,
chamado pelo loader dinâmico em `structure.html`.

**Nunca** copie as funções `_populateComplexity`, `_populateUseCases`, `_populateSnippets` —
todas estão em `StructureUI` e devem ser delegadas via `StructureUI.initMeta(meta, fallback)`.

### Segurança no DOM

```javascript
// ✅ CORRETO — sempre escape antes de usar innerHTML com dados externos
el.innerHTML = items.map(t => `<li>${_escapeHtml(t)}</li>`).join('');

// ❌ ERRADO — XSS se o JSON contiver <script> ou caracteres especiais
el.innerHTML = items.map(t => `<li>${t}</li>`).join('');

// ✅ CORRETO — use textContent para texto puro
el.textContent = someText;
```

O helper `_escapeHtml` já existe em `structure-ui.js`. Se precisar em outro módulo,
copie a implementação localmente (não crie dependência cruzada entre módulos).

### DRY — evite duplicação

| Responsabilidade | Onde está |
|---|---|
| Mostrar/ocultar campos do formulário | `StructureUI.syncFields()` |
| Tabela Big-O | `StructureUI.populateComplexity()` |
| Listas "Quando usar" | `StructureUI.populateUseCases()` |
| Snippets de código com abas | `StructureUI.populateSnippets()` |
| Inicializar tudo de uma vez | `StructureUI.initMeta()` |
| Painel de memória | `MemoryPanel.init()` / `MemoryPanel.update()` |
| Animação de passos | `Animator.load(steps)` |
| Renderização SVG | `Renderer.draw(snapshot)` |

---

## 6. Segurança (OWASP Top 10)

### A01 — Path Traversal

**Regra obrigatória:** qualquer `id` recebido de parâmetros de rota ou query string **deve**
ser validado contra `isKnownID()` antes de qualquer operação de I/O.

```go
// Em handlers HTTP:
if !isKnownID(id) {
    http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
    return
}

// Em loadStructureJSON (defesa em profundidade):
if !isKnownID(id) {
    return nil, fmt.Errorf("unknown structure id")
}
```

Nunca use `strings.ReplaceAll(id, "..", "")` ou `filepath.Base()` como única defesa.

### A03 — XSS / DOM Injection

1. **HTML de dados externos:** sempre passe por `_escapeHtml()` antes de `innerHTML`.
2. **Descrições de passos:** `animator.js` já escapa o texto antes do highlight — mantenha
   esse padrão ao adicionar tokens novos ao regex de `_hl()`.
3. **`jsMap` em `structure.html`:** nunca use o `id` bruto como nome de arquivo JS.
   O fallback é `''` com guard imediato, não `|| id`.
4. **`template.JS`:** o payload JSON em `window.__STRUCTURE_DATA__` usa `template.JS` do Go,
   que é seguro porque os dados vêm de arquivos controlados pelo desenvolvedor, não de input
   de usuário. Não use `template.JS` para dados vindos de requests HTTP.

### A05 — Security Misconfiguration

Os seguintes headers HTTP **devem** estar presentes em toda resposta.
O middleware `securityHeaders` em `main.go` já os garante — não remova:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
```

Erros internos **nunca** devem expor paths, stack traces ou mensagens do runtime ao cliente.
Sempre faça `log.Printf(...)` internamente e retorne `"internal server error"` ao cliente.

### O que NÃO implementar neste projeto

| Item | Motivo |
|---|---|
| HTTPS na aplicação | Responsabilidade do reverse proxy em produção |
| Rate limiting | Overkill para conteúdo estático educacional |
| Autenticação no endpoint `/__live-reload` | Endpoint dev-only, não chega a produção |
| SRI para Google Fonts | CDN gera CSS dinamicamente, SRI não é prático |
| Content Security Policy (CSP) | Templates usam `<script>` inline; CSP significativo exigiria nonces por request (refatoração maior) |

---

## 7. Princípios de Qualidade de Código

### SOLID

| Princípio | Aplicação neste projeto |
|---|---|
| **SRP** | Um arquivo Go = uma responsabilidade. Um módulo JS = um papel. |
| **OCP** | Adicionar estrutura: append no `registry`, nova entrada em `_typeStrategies`, novo arquivo JS. Zero mudanças em código existente. |
| **LSP** | Todos os módulos JS expõem a mesma interface de snapshot/step. |
| **ISP** | `StructureUI` expõe funções individuais; cada estrutura usa apenas o que precisa. |
| **DIP** | Estruturas JS dependem de `Animator`, `Renderer`, `MemoryPanel`, `StructureUI` — nunca de implementações umas das outras. |

### Regras gerais

- **DRY:** antes de escrever uma função nova, verifique se já existe em `StructureUI`,
  `MemoryPanel`, `Animator` ou `Renderer`.
- **Sem over-engineering:** não adicione abstrações para uso hipotético futuro. Três linhas
  similares são melhores que uma abstração prematura.
- **Sem comentários óbvios:** comente apenas o que não é evidente da leitura do código.
- **Sem feature flags:** altere o código diretamente.
- **Sem backwards-compatibility shims:** se algo foi removido, remova completamente.
- **Validação apenas na fronteira:** valide input de usuário e dados de requests HTTP.
  Não valide dados internos que você controla.

---

## 8. Simulação de Memória

Cada estrutura implementa uma simulação educacional de acesso à memória. Os valores são
aproximações didáticas, não medições reais.

### Array (localidade de referência)

```javascript
const BYTES_PER_ELEM = 4;   // int32
const ELEMS_PER_LINE = 16;  // 64B cache line / 4B = 16 elementos
const BASE_ADDR      = 0x1000;

function _cacheFor(idx) {
  const line = Math.floor(idx / ELEMS_PER_LINE);
  const hit  = line === _prevCacheLine;
  _prevCacheLine = line;
  return hit
    ? { event: 'hit',  cycles: 4,   note: `...L1...` }
    : { event: 'miss', cycles: 200, note: `...RAM...` };
}
```

### Listas encadeadas (fragmentação de memória)

```javascript
const BYTES_PER_NODE = 16;  // value(4) + pointer(8) + padding(4)
const BASE_ADDR      = 0x2000;

// Endereços fragmentados simulados via hash determinístico (Knuth)
function _nodeAddr(id) {
  const h = (id * 2654435761) >>> 0;
  return BASE_ADDR + (h % 0x0800);
}
// Cache miss muito mais frequente — ponteiros dispersos na memória
```

### Objeto `memory` retornado por `_buildMemory`

```javascript
{
  type:        'array' | 'linked',
  totalBytes:  number,
  event:       'hit' | 'miss' | null,
  cycles:      number | null,
  note:        string | null,
  accessedIdx: number | null,  // para array
  layout:      [{ value, addr }]
}
```

`MemoryPanel.update(memory)` consome este objeto. `MemoryPanel.resetStats()` é chamado
ao gerar nova estrutura ou reiniciar a animação.

---

## 9. Adicionando Novos Tipos de Visualização SVG

Se a nova estrutura exige um layout visual diferente (ex: árvore, grafo):

1. Adicione a estratégia em `_typeStrategies` (veja Passo 5 acima).
2. Se precisar de uma função de desenho de setas nova (ex: `_drawTreeArrows`), adicione-a
   como função privada em `renderer.js` e referencie-a na estratégia.
3. `draw(snapshot)` e `_createNode()` **não devem ser modificados** — eles são genéricos.
4. Atualize o comentário JSDoc no topo de `renderer.js` com o novo tipo.

---

## 10. Fluxo de Desenvolvimento

```
# Dev com live reload
DS_DEV_LIVE_RELOAD=1 go run ./cmd/server/

# Build de produção
go build ./cmd/server/

# Verificar compilação
go vet ./cmd/server/
```

**Variáveis de ambiente:**
- `DS_DEV_LIVE_RELOAD=1` — ativa live reload via SSE em `/__live-reload`
- `PORT=8080` — porta do servidor (padrão: 8080)

---

## 11. Checklist antes de fazer Push

- [ ] `go build ./cmd/server/` passa sem erros
- [ ] `go vet ./cmd/server/` passa sem warnings
- [ ] Nova estrutura: ID adicionado em `registry`, `Available: true`
- [ ] Nova estrutura: arquivo JSON criado em `content/structures/`
- [ ] Nova estrutura: arquivo JS criado em `web/static/js/structures/`
- [ ] Nova estrutura: ID mapeado em `jsMap` de `structure.html`
- [ ] Sem `err.Error()` exposto diretamente em `http.Error()`
- [ ] Sem uso de input de usuário sem validação via `isKnownID()` ou equivalente
- [ ] Sem `innerHTML` com dados externos sem `_escapeHtml()`
- [ ] Sem código duplicado que deveria usar `StructureUI`, `MemoryPanel`, etc.
- [ ] Descrições de passos em português, com padrão `Passo N/Total:`
