# Prompt Base — Adicionar Nova Estrutura de Dados ao DS Explorer

Use este arquivo como ponto de partida ao pedir para uma IA implementar uma nova estrutura.
Substitua os campos entre `{{ }}` antes de enviar.

---

## PROMPT

Você está trabalhando no projeto **DS Explorer** — uma aplicação web educacional em Go que
visualiza estruturas de dados passo a passo para alunos de graduação.

O projeto já existe e está funcionando. Seu objetivo é adicionar suporte à estrutura
**{{ NOME DA ESTRUTURA }}** (ID: `{{ id-da-estrutura }}`).

---

### CONTEXTO DO PROJETO

**Stack:**
- Backend: Go 1.22+ com `net/http`, sem frameworks externos
- Templates: `html/template`
- Frontend: Vanilla JS + CSS puro (sem React, Vue, Tailwind, D3, etc.)
- Sem banco de dados — toda simulação roda no navegador via JS

**Como o sistema funciona:**
1. O servidor Go serve a página `/structure/{id}` usando `structure.html`
2. O template injeta os metadados da estrutura via `{{ "{{" }}.Payload{{ "}}" }}` (JSON inline)
3. O JS detecta o ID da estrutura e carrega dinamicamente o arquivo `structures/{id}.js`
4. O arquivo JS exporta `initStructurePage()` que inicializa os controles e a simulação
5. `renderer.js` renderiza os nós em SVG; `animator.js` controla os passos da animação

**Arquivos existentes para referência:**
- `web/static/js/structures/array.js` — simulação de array estático
- `web/static/js/structures/singly.js` — simulação de lista encadeada simples
- `web/static/js/structures/doubly.js` — simulação de lista encadeada dupla
- `content/structures/array.json` — exemplo de metadados completos

---

### O QUE VOCÊ DEVE CRIAR

#### 1. `content/structures/{{ id-da-estrutura }}.json`

Metadados completos da estrutura. Use este schema:

```json
{
  "id": "{{ id-da-estrutura }}",
  "name": "{{ Nome Completo }}",
  "category": "{{ Linear Sequencial | Linear Encadeada | Árvore | Hash | Grafo }}",
  "description": "Descrição didática de 2-3 frases para um aluno de graduação.",
  "complexity": {
    "access":        { "best": "O(?)", "average": "O(?)", "worst": "O(?)" },
    "search":        { "best": "O(?)", "average": "O(?)", "worst": "O(?)" },
    "insertBegin":   { "best": "O(?)", "average": "O(?)", "worst": "O(?)" },
    "insertEnd":     { "best": "O(?)", "average": "O(?)", "worst": "O(?)" },
    "insertMiddle":  { "best": "O(?)", "average": "O(?)", "worst": "O(?)" },
    "delete":        { "best": "O(?)", "average": "O(?)", "worst": "O(?)" },
    "space":         "O(?)"
  },
  "useCases": {
    "recommended": [
      "{{ cenário real onde esta estrutura é boa opção }}",
      "..."
    ],
    "notRecommended": [
      "{{ cenário onde esta estrutura é má escolha }}",
      "..."
    ],
    "realWorldExamples": [
      "{{ ex: Pilha de chamadas de função (call stack) }}",
      "..."
    ]
  },
  "codeSnippets": {
    "csharp": "// Snippet mínimo comentado em C# — definição + operação principal",
    "python": "# Snippet mínimo comentado em Python",
    "javascript": "// Snippet mínimo comentado em JavaScript"
  }
}
```

#### 2. `web/static/js/structures/{{ id-da-estrutura }}.js`

Arquivo JavaScript com a lógica de simulação. **Requisitos obrigatórios:**

```js
// Estrutura geral esperada pelo sistema:

function initStructurePage() {
    // 1. Ler os metadados injetados no DOM pelo template Go
    //    const meta = JSON.parse(document.getElementById('structure-data').textContent);

    // 2. Preencher tabela de complexidade com meta.complexity
    // 3. Preencher seções "quando usar" com meta.useCases
    // 4. Preencher abas de código com meta.codeSnippets
    // 5. Configurar handlers dos botões: Gerar, Executar
    // 6. Configurar handler do seletor de operação (mostrar/ocultar campos)
}

// Funções internas de simulação:
// - generateSteps(operation, params, structure) → Array de steps
// - Cada step: { snapshot: [...nodes], description: "texto para o log" }
// - Cada node: { value, state: 'neutral'|'visiting'|'success'|'danger'|'warning' }

// Chamar Renderer.draw(svgEl, nodes, type) para renderizar
// Chamar Animator.load(steps, svgEl, logEl, type) para animar
```

**Estados de cor disponíveis:**
| Estado     | Cor    | Significado                    |
|------------|--------|--------------------------------|
| `neutral`  | Cinza  | Nó em repouso                  |
| `visiting` | Azul   | Sendo comparado/percorrido     |
| `success`  | Verde  | Inserido / encontrado          |
| `danger`   | Vermelho | Removido / não encontrado    |
| `warning`  | Amarelo | Sendo atualizado / realocado  |

**Tipos de renderização disponíveis em `Renderer.draw()`:**
- `'array'` — caixas com índices acima
- `'singly'` — nós com setas →, rótulo HEAD
- `'doubly'` — nós com setas ↔, rótulos HEAD e TAIL

> Se a estrutura for nova (ex: árvore, hash), informe e discuta como adaptar o renderer.

#### 3. `internal/structures/{{ pacote }}/{{ arquivo }}.go`

Implementação Go **didática** da estrutura. Não é usada pelo servidor em runtime — serve como
código de referência correto para uso em sala de aula.

**Requisitos:**
- Comentários em português em cada método
- Indicar a complexidade Big-O de cada operação nos comentários
- Código limpo e legível, sem otimizações prematuras
- Usar `errors.New()` para erros, nada de panic

#### 4. Registro no servidor (instruções para o desenvolvedor)

Após criar os arquivos, informe o desenvolvedor para fazer manualmente:

**a) Em `cmd/server/main.go`**, trocar `Available: false` para `Available: true` na entrada
correspondente (ou adicionar nova entrada se não existir):
```go
{ID: "{{ id-da-estrutura }}", Name: "{{ Nome }}", Available: true},
```

**b) Em `web/templates/structure.html`**, adicionar ao mapa `jsMap`:
```js
"{{ id-da-estrutura }}": "/static/js/structures/{{ id-da-estrutura }}.js",
```

---

### OPERAÇÕES A IMPLEMENTAR

Para a estrutura **{{ NOME DA ESTRUTURA }}**, implemente as seguintes operações na simulação JS:

{{ Liste aqui as operações específicas, por exemplo: }}

- [ ] `push` — inserir no topo
- [ ] `pop` — remover do topo
- [ ] `peek` — ver o topo sem remover
- [ ] `search` — buscar por valor
- [ ] `clear` — esvaziar a estrutura

---

### COMPORTAMENTO DA ANIMAÇÃO

Para cada operação, a simulação deve gerar uma sequência de **steps** onde:

1. O primeiro step mostra o estado inicial (todos os nós `neutral`)
2. Steps intermediários mostram o percurso, comparações e modificações com cores específicas
3. O último step mostra o estado final com o resultado da operação

O painel de log deve ter descrições em linguagem natural em português.
Exemplo: `"Passo 3/6: Verificando se o nó do topo é o valor buscado (42 ≠ 17)"`.

---

### O QUE NÃO FAZER

- Não usar bibliotecas JS externas (nem D3.js, Chart.js, Lodash, etc.)
- Não usar frameworks CSS
- Não alterar `renderer.js` ou `animator.js` (a menos que seja imprescindível e discutido)
- Não alterar `base.html`, `structure.html`, `home.html`
- Não criar testes, não criar README
- Não implementar outras estruturas além da solicitada neste prompt

---

### EXEMPLOS DE ESTRUTURAS FUTURAS E SEUS IDs

| Estrutura                    | ID sugerido         | Categoria              |
|------------------------------|---------------------|------------------------|
| Pilha (Stack)                | `stack`             | Linear Encadeada       |
| Fila (Queue)                 | `queue`             | Linear Encadeada       |
| Fila Circular                | `circular-queue`    | Linear Sequencial      |
| Deque                        | `deque`             | Linear Encadeada       |
| Árvore Binária               | `binary-tree`       | Árvore                 |
| Árvore BST                   | `bst`               | Árvore                 |
| Min Heap / Max Heap          | `heap`              | Árvore                 |
| Tabela Hash                  | `hash-table`        | Hash                   |
| Grafo (lista de adjacência)  | `graph`             | Grafo                  |

---

### CHECKLIST FINAL

Antes de considerar a implementação completa, verifique:

- [ ] `content/structures/{{ id }}.json` criado e válido (JSON sem erros de sintaxe)
- [ ] `web/static/js/structures/{{ id }}.js` exporta `initStructurePage()`
- [ ] Tabela de complexidade populada corretamente pelo JS
- [ ] Seções "quando usar" populadas pelo JS
- [ ] Abas de código (C#, Python, JS) funcionando
- [ ] Botão "Gerar" cria a estrutura com valores aleatórios
- [ ] Todas as operações listadas implementadas com animação passo a passo
- [ ] Log de passos em português
- [ ] `internal/structures/...` com implementação Go comentada
- [ ] Desenvolvedor instruído sobre as 2 alterações manuais em `main.go` e `structure.html`
