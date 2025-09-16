# SimpleAI

Extensão VS Code que aprende padrões do seu código (funções, classes, blocos) e sugere predições inline ou via ghost text. Também gera um relatório técnico do projeto e gerencia snippets simples.

## Principais Recursos

- Aprendizado autônomo de padrões (funções, classes, loops, imports) em JS/TS
- Sugestões preditivas compatíveis com Inline Completion API
- Ranking simples de padrões aprendidos (frequência + confiança)
- Comando de relatório do projeto (métricas estruturais e oportunidades de refatoração)
- Armazenamento local de snippets (salvar / listar / deletar)

> Recursos antigos como sincronização premium, sandbox isolado, busca semântica avançada e estatísticas detalhadas foram removidos para manter foco e simplicidade.

## Instalação

1. Abra o VS Code
2. Pressione `Ctrl+P`
3. Digite `ext install simpleai`
4. Ou instale do [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=simpleai)

## Uso Rápido

1. Abra um arquivo JavaScript ou TypeScript
2. Comece a digitar – o sistema aprende padrões automaticamente
3. Sugestões aparecem inline (modo padrão) ou como ghost text
4. Use a Command Palette (Ctrl+Shift+P) e digite “SimpleAI” para ver comandos
5. Gere um relatório: `SimpleAI: Gerar Relatório do Projeto`

Para documentação completa (configurações, comandos detalhados e exemplos), consulte `GUIA_USO.md`.

## Desenvolvimento

### Pré-requisitos

- Node.js 14+
- VS Code
- Git

### Setup

1. Clone o repositório:
\`\`\`bash
git clone https://github.com/user/simpleai.git
cd simpleai
\`\`\`

2. Instale as dependências:
\`\`\`bash
npm install
\`\`\`

3. Compile a extensão:
\`\`\`bash
npm run compile
\`\`\`

### Scripts Disponíveis

- `npm run compile`: Compila o código TypeScript
- `npm run watch`: Compila em modo watch
- `npm run test`: Executa testes unitários
- `npm run coverage`: Gera relatório de cobertura de testes
- `npm run package`: Empacota a extensão para publicação

### Testes

A extensão usa Mocha como framework de testes, Chai para assertions e Sinon para mocks.

Para executar os testes:

\`\`\`bash
npm run test
\`\`\`

Para ver a cobertura de testes:

\`\`\`bash
npm run coverage
\`\`\`

### Estrutura Essencial

| Caminho | Descrição |
|--------|-----------|
| `src/extension.ts` | Registro de comandos e providers |
| `src/autonomousLearning.ts` | Extração / armazenamento de padrões aprendidos |
| `src/predictiveAssistant.ts` | Geração de predições |
| `src/inlineCompletionProvider.ts` | Sugestões inline (modo padrão) |
| `src/projectAnalyzer.ts` | Métricas e relatório do projeto |
| `src/snippetStorage.ts` | Persistência de snippets |
| `test/` | Testes Mocha/Chai |

## Contribuição

Pull Requests são bem-vindos para refatorações, novos heurísticos de análise ou suporte a outras linguagens.

## Licença

MIT

---

Mantido enxuto intencionalmente. Para detalhes completos: veja `GUIA_USO.md`.
# SimpleAI
