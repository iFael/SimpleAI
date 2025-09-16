# Guia de Instalação e Uso - SimpleAI

## 📦 Instalação

### Pré-requisitos
- VS Code 1.75.0 ou superior
- Node.js (para desenvolvimento)

### Método 1: Instalação Local (Desenvolvimento)
1. Clone ou baixe este projeto
2. Abra o terminal no diretório do projeto
3. Execute: `npm install`
4. Execute: `npm run compile`
5. Pressione `F5` no VS Code para executar em uma nova janela

### Método 2: Instalar como Extensão
1. No terminal: `npm run package`
2. Instale o arquivo `.vsix` gerado

## 🎯 Como Usar

### 1. **Ativação Automática**
A extensão ativa automaticamente quando você abre arquivos JavaScript ou TypeScript.

### 2. **Aprendizado Autônomo**
- **Inicia automaticamente** quando você edita código
- **Monitora padrões** em tempo real
- **Aprende continuamente** sem intervenção

```javascript
// A extensão aprende automaticamente padrões como este:
function processarDados(dados) {
    for (let i = 0; i < dados.length; i++) {
        console.log(dados[i]);
    }
    return dados;
}
```

### 3. **Sistema Preditivo**
Quando você começa a digitar, o sistema mostra predições em **ghost text**:

```javascript
function novaFuncao() {
    const lista = [1, 2, 3];
    // Ao digitar "for", aparece: for (let i = 0; i < lista.length; i++) {
    for|  // ← cursor aqui, predição aparece em cinza
}
```

### 4. **Comandos Disponíveis**

#### Abrir Command Palette (`Ctrl+Shift+P`) e digitar:

**Snippets:**
- `SimpleAI: Salvar Snippet` – Salva seleção atual
- `SimpleAI: Listar Snippets` – Lista e permite inserir
- `SimpleAI: Deletar Snippet` – Remove um snippet escolhido

**Predição:**
- `SimpleAI: Aceitar Predição` – Aceita a sugestão atual
- `SimpleAI: Rejeitar Predição` – Rejeita a sugestão atual
- `SimpleAI: Alternar Rótulo de Predição` – Mostra/oculta rótulo visual
- `SimpleAI: Alternar Metadados da Predição` – Mostra/oculta confiança
- `SimpleAI: Alternar Aceitação via Tab` – Liga/desliga uso da tecla Tab
- `SimpleAI: Escanear Workspace por Padrões` – Varredura inicial (seed) de padrões
- `SimpleAI: Exibir Ranking de Padrões` – Ranking simples (frequência + confiança)
- `SimpleAI: Gerar Relatório do Projeto` – Gera relatório Markdown com métricas estruturais e padrões aprendidos

### 5. **Atalhos de Teclado**

Nenhum atalho customizado é instalado por padrão (para evitar conflito). Se habilitar a aceitação via Tab nas configurações (`simpleai.enableTabKey = true`), Tab aceitará a predição quando presente. Caso contrário, use o comando “Aceitar Predição” via palette.

## 🎮 Exemplos de Uso

### Exemplo 1: Padrão de Loop
```javascript
// 1. Digite este padrão algumas vezes:
for (let i = 0; i < array.length; i++) {
    console.log(array[i]);
}

// 2. Na próxima vez que digitar "for", 
//    o sistema prediz automaticamente o padrão completo
```

### Exemplo 2: Padrão de Função
```javascript
// 1. Use este padrão:
function calcular(a, b) {
    return a + b;
}

// 2. Ao digitar "function", recebe sugestões baseadas no padrão
```

### Exemplo 3: Padrão de Error Handling
```javascript
// 1. Use frequentemente:
try {
    // código
} catch (error) {
    console.error('Erro:', error);
}

// 2. Sistema aprende e sugere ao digitar "try"
```

## 📊 Ranking de Padrões

Use: `SimpleAI: Exibir Ranking de Padrões`

Saída exemplo (plaintext):
```
RANKING DE PADRÕES APRENDIDOS
--------------------------------
01 | freq= 12 | conf= 82% | function processarDados(dados) {
02 | freq=  9 | conf= 75% | for (let i = 0; i < lista.length; i++) {
03 | freq=  7 | conf= 70% | try {
```

Interpretando:
- freq: número de vezes que o fragmento foi observado/reforçado
- conf: confiança heurística (0–100%)
- primeira linha: preview truncado do fragmento

O sistema mantém apenas padrões recentes/relevantes (limpeza periódica em background).

## 📄 Relatório do Projeto

Use: `SimpleAI: Gerar Relatório do Projeto`

Gera um arquivo Markdown com:
- Resumo (arquivos, linhas, funções, classes, tamanho médio)
- Distribuição de linguagens
- Maiores funções (top 10)
- Padrões aprendidos (top 20)
- Oportunidades de refatoração (funções muito longas, ifs profundamente aninhados, blocos try extensos)

As heurísticas são simples e servem como ponto de partida para inspeções manuais.

## ⚙️ Configurações Avançadas

### Ajustando Sensibilidade
A extensão usa thresholds internos:
- **Confiança mínima**: 70% para mostrar predições
- **Similaridade**: Algoritmo de Levenshtein + análise AST
- **Velocity Tracking**: Adapta à velocidade de digitação

### Personalização
Configurações disponíveis em Settings > Extensions > SimpleAI ou via JSON:

| Chave | Default | Descrição |
|-------|---------|-----------|
| `simpleai.predictionColor` | `#8888ff90` | Cor usada no ghost text quando o tema não destaca bem. |
| `simpleai.showPredictionLabel` | `true` | Mostra um rótulo (ex: ·SimpleAI·) para diferenciar de outras AIs. |
| `simpleai.predictionLabelText` | `·SimpleAI·` | Texto exibido como rótulo (não é inserido no código). |
| `simpleai.predictionLabelPosition` | `prefix` | Posição do rótulo: `prefix` (antes) ou `suffix` (depois) do texto previsto. |
| `simpleai.predictionBackgroundColor` | `rgba(136,136,255,0.08)` | Cor de fundo semi-transparente para destacar a predição. Vazio desativa. |
| `simpleai.showPredictionMeta` | `false` | Exibe metadados como confiança (%) junto ao rótulo. |
| `simpleai.enableTabKey` | `false` | Permite aceitar predição com Tab. |
| `simpleai.previewMaxLength` | `80` | Tamanho máximo do trecho visual exibido (restante inserido só ao aceitar). |
| `simpleai.predictionRenderMode` | `inline` | `inline` (Inline Completion API) ou `decoration` (decoração custom). |

Exemplo de configuração em `settings.json`:
```json
{
    "simpleai.predictionColor": "#99999990",
    "simpleai.showPredictionLabel": true,
    "simpleai.predictionLabelText": "·SimpleAI·",
    "simpleai.predictionLabelPosition": "prefix",
    "simpleai.predictionBackgroundColor": "rgba(120,120,255,0.10)",
    "simpleai.showPredictionMeta": true
}
```

### Ajustes Internos (Código)
Heurísticas principais em:
- `src/autonomousLearning.ts` (extração e confiança de padrões)
- `src/predictiveAssistant.ts` (seleção de sugestão / quickPrediction)
- `src/projectAnalyzer.ts` (métricas e refatorações simples)

## 🐛 Solução de Problemas

### Predições não aparecem?
1. Verifique se há padrões suficientes: `SimpleAI: Show Learning Stats`
2. Use `SimpleAI: Enable Prediction` para ativar
3. Digite padrões similares múltiplas vezes para ensinar o sistema
4. Use `SimpleAI: Toggle Prediction Label` se quiser ocultar o rótulo e comparar
5. Ajuste `predictionColor` ou `predictionBackgroundColor` se estiver ilegível

### Aprendizado não funciona?
1. Use `SimpleAI: Toggle Learning` para ativar
2. Verifique se está editando arquivos JS/TS
3. Espere alguns segundos para análise de padrões

### Performance lenta?
1. Use `SimpleAI: Clear All Snippets` para limpar cache
2. Reduza o número de padrões armazenados
3. Desative temporariamente: `SimpleAI: Disable Prediction`
4. Desative metadados: `SimpleAI: Toggle Prediction Meta` se houver distração

## 🔧 Desenvolvimento

### Estrutura do Projeto
```
src/
├── extension.ts           # Ponto de entrada
├── patternAnalyzer.ts     # Análise de padrões
├── autonomousLearning.ts  # Sistema de aprendizado
├── predictiveAssistant.ts # Motor de predição
├── snippetStorage.ts      # Armazenamento
└── ...outros módulos
```

### Compilar e Testar
```bash
npm install       # Instalar dependências
npm run watch    # Compilação contínua
npm run package  # Gerar .vsix
```

### Debuggar
1. Abra o projeto no VS Code
2. Pressione `F5` para debug
3. Nova janela do VS Code abre com a extensão carregada
4. Use `Developer Tools` (`Ctrl+Shift+I`) para logs

## 📈 Roadmap (Atualizado)

Próximos passos planejados (não garantidos):
- Suporte a linguagens adicionais
- Persistência/sincronização remota opcional
- Regras de refatoração mais ricas (duplicação, acoplamento rudimentar)
- Filtro avançado de padrões aprendidos
- Ajuste de confiança adaptativo

## 🤝 Contribuição

Contributions são bem-vindas! 

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob licença MIT. Veja `LICENSE` para detalhes.

---

**SimpleAI - Codificação inteligente que aprende com você! 🚀**