# SimpleAI

<!-- Badges -->
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-initial--alpha-blue)
![Node](https://img.shields.io/badge/node-%3E=18.0.0-339933?logo=node.js)
<!-- Futuro: badge do Marketplace / CI -->

Extensão VS Code que aprende padrões do seu código (funções, classes, blocos) e sugere predições inline ou via ghost text. Também gera um relatório técnico do projeto e gerencia snippets simples.

> Objetivo: focar em um núcleo simples de aprendizado de padrões + sugestões contextuais sem dependência de LLM externo.

## Principais Recursos

- Aprendizado autônomo de padrões (funções, classes, loops, imports) em JS/TS
- Sugestões preditivas via Inline Completion API (ghost text)
- Ranking simples de padrões (frequência + confiança)
- Relatório estrutural do projeto (heurísticas de complexidade e oportunidades)
- Armazenamento local de snippets (salvar / listar / deletar)
- Webview básica para visualização futura (placeholder)

> Recursos antigos como sincronização premium, sandbox isolado, busca semântica avançada e estatísticas detalhadas foram removidos para manter foco e simplicidade.

## Instalação

(Quando publicada no Marketplace, substitua este bloco.)

1. Clone este repositório e abra no VS Code.
2. `npm install`
3. Pressione F5 para iniciar a extensão em uma janela de desenvolvimento.

Ou (futuro Marketplace):

```
ext install simpleai
```

## Uso Rápido

1. Abra um arquivo JavaScript ou TypeScript.
2. Digite normalmente – o motor aprende padrões durante a edição.
3. Sugestões aparecem inline.
4. Command Palette: `SimpleAI: Gerar Relatório do Projeto` para análise.
5. Snippets: comandos `SimpleAI: Salvar Snippet Atual` e `SimpleAI: Listar Snippets`.

Para detalhes (configurações, limites e exemplos), consulte `GUIA_USO.md`.

## Testes

```
npm run test
```
Cobertura:
```
npm run coverage
```

## Scripts Disponíveis

| Script | Ação |
| ------ | ----- |
| `npm run compile` | Compila TypeScript |
| `npm run watch` | Compila em modo watch |
| `npm run test` | Executa testes unitários |
| `npm run coverage` | Relatório de cobertura |
| `npm run package` | Empacota a extensão (vsce) |

## Estrutura Essencial

| Caminho | Descrição |
|--------|-----------|
| `src/extension.ts` | Registro de comandos e providers |
| `src/autonomousLearning.ts` | Extração / armazenamento de padrões |
| `src/predictiveAssistant.ts` | Geração de sugestões |
| `src/inlineCompletionProvider.ts` | Provider de inline completions |
| `src/patternAnalyzer.ts` | Heurísticas de análise de padrões |
| `src/projectAnalyzer.ts` | Métricas e relatório |
| `src/snippetStorage.ts` | Persistência de snippets |
| `test/` | Testes Mocha/Chai |

## Contribuição

Pull Requests são bem-vindos! Recomendações:

1. Abra uma issue descrevendo a mudança.
2. Mantenha cobertura de testes (adicione casos para novos componentes).
3. Siga estilo consistente (TypeScript estrito quando possível).
4. Commits: convensão `tipo: descrição` (ex: `feat: adicionar suporte básico a python`).

## Licença

Distribuído sob a Licença MIT. Veja `LICENSE`.

---
Mantido enxuto intencionalmente. Para detalhes completos: `GUIA_USO.md`
