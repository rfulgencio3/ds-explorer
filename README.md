# DS Explorer

Aplicação web educacional interativa para visualização de estruturas de dados e algoritmos, destinada a alunos de graduação em Estrutura de Dados.

## Stack

- **Backend:** Go 1.22+ com `net/http` (sem frameworks externos)
- **Templates:** `html/template` (Go)
- **Frontend:** Vanilla JavaScript + CSS puro com variáveis
- **Persistência:** Nenhuma — toda simulação roda no navegador via JS

## Pré-requisitos

- [Go 1.22+](https://go.dev/dl/)
- (Opcional) [Docker](https://docs.docker.com/get-docker/)

## Executar localmente

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd ds-explorer

# Inicie o servidor (a partir da raiz do projeto)
go run ./cmd/server

# Acesse no navegador
http://localhost:8080
```

> **Importante:** execute o `go run` a partir da raiz do projeto (`ds-explorer/`), pois o servidor busca os diretórios `web/` e `content/` relativos ao diretório de trabalho.

## Executar com Docker

```bash
# Build da imagem
docker build -t ds-explorer .

# Executar o container
docker run -p 8080:8080 ds-explorer

# Acesse no navegador
http://localhost:8080
```

## Estrutura do projeto

```
ds-explorer/
├── cmd/server/
│   └── main.go                    # Servidor HTTP, rotas, serve templates
├── internal/
│   └── structures/                # Implementações Go (referência didática)
│       ├── array/
│       │   └── array.go           # Array estático com operações comentadas
│       └── linkedlist/
│           ├── singly.go          # Lista encadeada simples
│           └── doubly.go          # Lista encadeada dupla
├── web/
│   ├── templates/
│   │   ├── base.html              # Layout base (nav, head, scripts)
│   │   ├── home.html              # Página inicial com cards das estruturas
│   │   ├── structure.html         # Visualizador interativo de cada estrutura
│   │   └── compare.html           # Placeholder para comparativo futuro
│   └── static/
│       ├── css/
│       │   ├── main.css           # Reset, variáveis de cor, tipografia
│       │   ├── structure.css      # Estilos da visualização e painéis
│       │   └── animations.css     # Animações CSS das operações
│       └── js/
│           ├── core/
│           │   ├── renderer.js    # Renderiza nós e setas no SVG
│           │   └── animator.js    # Controla steps de animação
│           └── structures/
│               ├── array.js       # Simulação do Array estático
│               ├── singly.js      # Simulação da Lista Encadeada Simples
│               └── doubly.js      # Simulação da Lista Encadeada Dupla
├── content/
│   └── structures/
│       ├── array.json             # Metadados: Big-O, casos de uso, snippets
│       ├── singly-linked-list.json
│       └── doubly-linked-list.json
├── go.mod
├── Dockerfile
└── NEXT_FEATURE_PROMPT.md         # Prompt base para adicionar novas estruturas
```

## Rotas disponíveis

| Rota                      | Descrição                                      |
|---------------------------|------------------------------------------------|
| `GET /`                   | Página inicial com lista de estruturas         |
| `GET /structure/{id}`     | Visualizador da estrutura (ex: `/structure/array`) |
| `GET /api/structure/{id}` | API JSON com metadados da estrutura            |
| `GET /compare`            | Placeholder para comparativo futuro            |
| `GET /static/...`         | Arquivos estáticos (CSS, JS)                   |

IDs disponíveis: `array`, `singly-linked-list`, `doubly-linked-list`

## Estruturas implementadas (MVP)

| Estrutura              | ID                   | Status       |
|------------------------|----------------------|--------------|
| Array Estático         | `array`              | ✅ Disponível |
| Lista Encadeada Simples | `singly-linked-list` | ✅ Disponível |
| Lista Encadeada Dupla  | `doubly-linked-list` | ✅ Disponível |
| Pilha                  | `stack`              | 🔜 Em breve   |
| Fila                   | `queue`              | 🔜 Em breve   |
| Árvore Binária         | `binary-tree`        | 🔜 Em breve   |

## Como adicionar uma nova estrutura

Adicionar uma estrutura exige apenas **3 passos**, sem alterar templates ou o core de animação:

### 1. Criar o arquivo de metadados

```
content/structures/{id}.json
```

Siga o formato dos arquivos existentes: `id`, `name`, `category`, `description`, `complexity`, `useCases`, `codeSnippets`.

### 2. Criar o módulo JavaScript de simulação

```
web/static/js/structures/{id}.js
```

O arquivo deve exportar a função `initStructurePage()`. Veja `array.js` ou `singly.js` como referência.

### 3. Registrar no servidor

Em [cmd/server/main.go](cmd/server/main.go), adicione uma entrada no slice `registry`:

```go
{ID: "stack", Name: "Pilha", Available: true},
```

E mapeie o ID ao arquivo JS em [web/templates/structure.html](web/templates/structure.html):

```js
const jsMap = {
    "array":              "/static/js/structures/array.js",
    "singly-linked-list": "/static/js/structures/singly.js",
    "doubly-linked-list": "/static/js/structures/doubly.js",
    "stack":              "/static/js/structures/stack.js",   // novo
};
```

> Para um guia detalhado com prompt pronto para IA, veja [NEXT_FEATURE_PROMPT.md](NEXT_FEATURE_PROMPT.md).

## Implementações de referência em Go

Os arquivos em `internal/structures/` são **código didático comentado** — não são usados pelo servidor em produção. Servem como:

- Material de sala de aula (código correto e legível)
- Referência para verificar a lógica implementada no JS
- Base para exemplos ao vivo durante a aula

## Paleta de cores

| Variável CSS          | Cor       | Uso                        |
|-----------------------|-----------|----------------------------|
| `--color-bg`          | `#0f1117` | Fundo da página            |
| `--color-surface`     | `#1a1d27` | Cards e painéis            |
| `--color-primary`     | `#4f8ef7` | Ações principais, links    |
| `--color-success`     | `#41b36e` | Inserção bem-sucedida      |
| `--color-danger`      | `#e05c5c` | Remoção, erro              |
| `--color-warning`     | `#f5a623` | Atualização, realocação    |
| `--color-text`        | `#e2e8f0` | Texto principal            |
| `--color-text-muted`  | `#8892a4` | Texto secundário           |
