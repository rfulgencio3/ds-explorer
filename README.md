# [ds-explorer]

Projeto educacional open-source para visualização interativa de estruturas de dados, notação assintótica e comportamento de memória.

O foco do `ds-explorer` é servir como ferramenta didática para estudo, demonstração em aula e exploração prática por estudantes e instrutores. O projeto não tenta ser uma biblioteca de produção; ele prioriza clareza visual, animação passo a passo e explicações acessíveis.

## Objetivo educacional

O projeto foi pensado para apoiar o ensino de Estruturas de Dados e Algoritmos por meio de:

- visualização de operações passo a passo
- comparação entre custo assintótico e custo real percebido
- explicações sobre localidade de memória e hierarquia de caches
- exemplos de implementação em múltiplas linguagens
- organização taxonômica das estruturas para estudo progressivo

## Stack

- **Backend:** Go 1.22+ com `net/http`
- **Templates:** `html/template`
- **Frontend:** Vanilla JavaScript + CSS puro
- **IA educacional:** Google Gemini API (via proxy Go — chave nunca exposta ao browser)
- **Persistência:** nenhuma; as simulações rodam no navegador

## Pré-requisitos

- [Go 1.22+](https://go.dev/dl/)
- (Opcional) [Docker](https://docs.docker.com/get-docker/)

## Executar localmente

```bash
git clone https://github.com/rfulgencio3/ds-explorer.git
cd ds-explorer
go run ./cmd/server
```

Abra:

```text
http://localhost:8080
```

## Executar com Docker

```bash
docker build -t ds-explorer .
docker run -p 8080:8080 ds-explorer
```

## Ada IA — assistente educacional

Cada página de estrutura conta com um widget flutuante **Ada IA**, uma assistente educacional criada em homenagem a [Ada Lovelace](https://pt.wikipedia.org/wiki/Ada_Lovelace) — a primeira programadora da história.

A Ada responde perguntas em português, focada na estrutura de dados que está sendo estudada. As respostas são geradas pelo Google Gemini e o contexto da estrutura (nome, categoria, complexidade) é enviado automaticamente ao modelo.

### Configuração

| Variável de ambiente | Descrição | Obrigatório |
|---|---|---|
| `GEMINI_API_KEY` | Chave da API Google AI Studio | Sim |
| `GEMINI_MODEL` | Modelo Gemini a usar (padrão: `gemini-2.5-flash`) | Não |

Sem `GEMINI_API_KEY`, o widget exibe a mensagem _"Ada IA não está configurada no momento"_ e nenhuma chamada à API é feita.

Obtenha uma chave gratuita em [aistudio.google.com](https://aistudio.google.com/app/apikey).

## Páginas disponíveis

| Rota | Descrição |
|---|---|
| `GET /` | Home com cards das estruturas |
| `GET /structure/{id}` | Visualizador interativo da estrutura |
| `GET /references` | Página de referências e taxonomia |
| `GET /big-o` | Guia de notação assintótica |
| `GET /memory-hierarchy` | Guia de hierarquia de memória |
| `GET /compare` | Placeholder para comparação futura |
| `GET /api/structures` | Lista das estruturas em JSON |
| `GET /api/structure/{id}` | Metadados JSON de uma estrutura |
| `POST /api/ai/ask` | Proxy para o Gemini (Ada IA) |

## Estruturas atualmente implementadas

| Estrutura | ID | Categoria | Subtipo | Status |
|---|---|---|---|---|
| Array Estático | `array` | Linear | Sequencial | Disponível |
| Lista Dinâmica | `dynamic-list` | Linear | Sequencial | Disponível |
| Lista Encadeada Simples | `singly-linked-list` | Linear | Encadeada | Disponível |
| Lista Encadeada Dupla | `doubly-linked-list` | Linear | Encadeada | Disponível |
| Lista Circular | `circular-list` | Linear | Encadeada | Disponível |
| Pilha (Stack) | `stack` | Linear | Restrita | Disponível |
| Fila (Queue) | `queue` | Linear | Restrita | Disponível |
| Fila Circular | `circular-queue` | Linear | Restrita | Disponível |
| Deque | `deque` | Linear | Restrita | Disponível |

## Estruturas planejadas

| Estrutura | Categoria | Subtipo | Status |
|---|---|---|---|
| Árvore Binária de Busca | Árvore | - | Em breve |
| Árvore AVL | Árvore | - | Em breve |
| Heap | Árvore | - | Em breve |
| Tabela Hash | Hash | - | Em breve |
| Grafo | Grafo | - | Em breve |
| Skip List | Linear | Probabilística | Em breve |
| Trie | Árvore | - | Em breve |

## Estrutura do projeto

```text
ds-explorer/
├── cmd/server/                  # Servidor HTTP e catálogo das estruturas
├── content/structures/          # Metadados JSON por estrutura
├── internal/structures/         # Implementações de referência em Go
├── web/templates/               # Templates HTML
├── web/static/css/              # Estilos globais e específicos
├── web/static/js/core/          # Renderer, animator, painel de memória
├── web/static/js/structures/    # Simulações por estrutura
├── Dockerfile
├── go.mod
└── README.md
```

## Conteúdo didático já coberto

- classificação por família estrutural e subtipo
- Big-O com tooltip e cores por faixa de complexidade
- referências técnicas por estrutura
- explicação de `O`, `Ω`, `Θ`, `o`, `ω`
- gráfico de crescimento assintótico
- introdução a `L1`, `L2`, `L3` e `RAM`
- simulação visual de acesso à hierarquia de memória
- assistente IA educacional (Ada IA) integrada em cada estrutura

## Como adicionar uma nova estrutura

O fluxo padrão é:

1. criar um novo arquivo em `content/structures/{id}.json`
2. criar a simulação em `web/static/js/structures/{arquivo}.js`
3. registrar a estrutura no `registry` em `cmd/server/main.go`
4. mapear o `id` para o arquivo JS em `web/templates/structure.html`, se necessário

## Implementações de referência em Go

Os arquivos em `internal/structures/` existem como apoio pedagógico. Eles não são a fonte da animação do navegador; servem como:

- referência de implementação
- material de estudo
- base para exemplos em aula

## Observação

Este é um projeto educacional. Algumas simplificações visuais e de simulação são intencionais para favorecer compreensão, mesmo quando o comportamento real de hardware ou runtime é mais complexo.
