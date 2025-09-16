import * as vscode from 'vscode';
import { SimpleAICompletionProvider } from './completionProvider';
import { SimpleAIHoverProvider } from './hoverProvider';
import { PatternAnalyzer } from './patternAnalyzer';
import { SnippetStorage } from './snippetStorage';
import { WebviewManager } from './webviewManager';
import { AutonomousLearningSystem } from './autonomousLearning';
import { PredictiveCodeAssistant } from './predictiveAssistant';
import { SimpleAIInlineCompletionProvider } from './inlineCompletionProvider';
import { ProjectAnalyzer } from './projectAnalyzer';

export async function activate(context: vscode.ExtensionContext) {
  // Log de diagnóstico para confirmar ativação no host da extensão
  console.log('[SimpleAI] activate() chamado - registrando comandos e provedores');
  vscode.window.showInformationMessage('SimpleAI: ativação iniciando (diagnóstico)');
  // inicializar subsistemas
  const storage = new SnippetStorage(context);
  const analyzer = new PatternAnalyzer(context);
  const webview = new WebviewManager(context, storage, analyzer);
  
  // Initialize autonomous learning system
  const learningSystem = new AutonomousLearningSystem(context, analyzer);
  
  // Initialize predictive code assistant
  const predictiveAssistant = new PredictiveCodeAssistant(learningSystem);
  const projectAnalyzer = new ProjectAnalyzer();

  // register completion and hover for JS/TS
  const selector: vscode.DocumentSelector = [
    { language: 'javascript', scheme: 'file' },
    { language: 'typescript', scheme: 'file' }
  ];

  // Registrar inline completion provider se modo inline (após declarar selector)
  const renderMode = vscode.workspace.getConfiguration('simpleai').get<string>('predictionRenderMode','inline');
  if (renderMode === 'inline') {
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(selector, new SimpleAIInlineCompletionProvider(predictiveAssistant))
    );
  }

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector, 
      new SimpleAICompletionProvider(storage, analyzer, learningSystem), 
      '.' // Removido '\n' para não capturar Enter e permitir quebra de linha normal
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, new SimpleAIHoverProvider(storage, analyzer))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.help', () => webview.showHelp())
  );

  // Comando para salvar snippet
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.saveSnippet', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const sel = editor.selection;
      const text = editor.document.getText(sel);
      if (!text) { 
        vscode.window.showInformationMessage('Selecione o código para criar um snippet.'); 
        return; 
      }
      const snippet = await analyzer.suggestSnippetFromCode(text);
      await storage.saveSnippet(snippet);
      vscode.window.showInformationMessage('Snippet salvo com sucesso!');
    })
  );

  // Comando para listar snippets
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.listSnippets', async () => {
      const snippets = await storage.listSnippets();
      if (snippets.length === 0) {
        vscode.window.showInformationMessage('Nenhum snippet encontrado.');
        return;
      }
      const items = snippets.map(s => ({
        label: s.title || 'Sem título',
        description: s.language,
        detail: s.code,
        snippet: s
      }));
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Selecione um snippet para inserir'
      });
      
      if (selected) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          editor.insertSnippet(new vscode.SnippetString(selected.snippet.code));
        }
      }
    })
  );

  // Comando para deletar snippet
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.deleteSnippet', async () => {
      const snippets = await storage.listSnippets();
      if (snippets.length === 0) {
        vscode.window.showInformationMessage('Nenhum snippet para deletar.');
        return;
      }
      
      const items = snippets.map(s => ({
        label: s.title || 'Sem título',
        description: s.language,
        detail: s.code,
        snippet: s
      }));
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Selecione um snippet para deletar'
      });
      
      if (selected) {
        await storage.deleteSnippet(selected.snippet);
        vscode.window.showInformationMessage('Snippet deletado com sucesso!');
      }
    })
  );


  // Comando: alternar exibição do label de predição
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.togglePredictionLabel', async () => {
      const config = vscode.workspace.getConfiguration('simpleai');
      const current = config.get<boolean>('showPredictionLabel', true);
      await config.update('showPredictionLabel', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`SimpleAI: Label de predição ${!current ? 'ativado' : 'desativado'}.`);
      // Força refresh limpando/reatribuindo uma decoração vazia
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        // Nenhuma ação específica necessária; próxima predição já usará o novo valor.
      }
    })
  );

  // Comando: alternar exibição de metadados da predição
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.togglePredictionMeta', async () => {
      const config = vscode.workspace.getConfiguration('simpleai');
      const current = config.get<boolean>('showPredictionMeta', false);
      await config.update('showPredictionMeta', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`SimpleAI: Metadados de predição ${!current ? 'ativados' : 'desativados'}.`);
    })
  );

  // Comando: alternar uso do Tab para aceitar predição
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.toggleTabAcceptance', async () => {
      const config = vscode.workspace.getConfiguration('simpleai');
      const current = config.get<boolean>('enableTabKey', false);
      await config.update('enableTabKey', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`SimpleAI: Aceitação via Tab ${!current ? 'ativada' : 'desativada'}.`);
    })
  );

  // Comando: exibir ranking de padrões aprendidos (formal)
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.showLearningStats', async () => {
      const top = (learningSystem as any).getTopPatterns ? (learningSystem as any).getTopPatterns(15) : [];
      if (!top.length) {
        vscode.window.showInformationMessage('SimpleAI: Nenhum padrão aprendido ainda.');
        return;
      }
      const lines = top.map((p: any, i: number) => (
        `${(i+1).toString().padStart(2,'0')} | freq=${p.frequency.toString().padStart(3,' ')} | conf=${(p.confidence*100).toFixed(0).padStart(3,' ')}% | ${p.firstLine}`
      ));
      const text = ['RANKING DE PADRÕES APRENDIDOS','--------------------------------', ...lines].join('\n');
      const doc = await vscode.workspace.openTextDocument({ content: text, language: 'plaintext' });
      await vscode.window.showTextDocument(doc, { preview: false });
    })
  );

  // Comando: gerar relatório de projeto
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.generateProjectReport', async () => {
      vscode.window.setStatusBarMessage('SimpleAI: Gerando relatório do projeto...', 3000);
      const metrics = await projectAnalyzer.collectMetrics();
      const topPatterns = (learningSystem as any).getTopPatterns ? (learningSystem as any).getTopPatterns(20) : [];
      const now = new Date();
      const md: string[] = [];
      md.push(`# Relatório do Projeto - SimpleAI`);
      md.push(`Gerado em: ${now.toLocaleString()}`);
      md.push('');
      md.push('## Resumo');
      md.push(`- Arquivos analisados: ${metrics.totalFiles}`);
      md.push(`- Linhas totais: ${metrics.totalLines}`);
      md.push(`- Funções detectadas: ${metrics.functions.length}`);
      md.push(`- Classes detectadas: ${metrics.classes.length}`);
      md.push(`- Tamanho médio de função: ${metrics.averageFunctionSize} linhas`);
      md.push('');
      md.push('## Distribuição de Linguagens');
      Object.entries(metrics.languageDistribution).forEach(([lang,count])=>{
        md.push(`- ${lang}: ${count}`);
      });
      if (!Object.keys(metrics.languageDistribution).length) {
        md.push('_Nenhuma linguagem suportada encontrada._');
      }
      md.push('');
      md.push('## Maiores Funções (Top 10)');
      if (metrics.largestFunctions.length) {
        metrics.largestFunctions.forEach(f => md.push(`- ${f.name} (${f.lines} linhas) - ${f.file}`));
      } else {
        md.push('_Nenhuma função encontrada._');
      }
      md.push('');
      md.push('## Padrões Aprendidos (Top 20 por frequência)');
      if (topPatterns.length) {
        topPatterns.forEach((p:any,i:number)=> md.push(`${(i+1).toString().padStart(2,'0')}. freq=${p.frequency} conf=${(p.confidence*100).toFixed(0)}% - ${p.firstLine}`));
      } else {
        md.push('_Nenhum padrão aprendido acumulado ainda._');
      }
      md.push('');
      md.push('## Oportunidades de Refatoração');
      if (metrics.potentialRefactors.length) {
        metrics.potentialRefactors.slice(0,20).forEach(r => {
          md.push(`### ${r.reason} (${r.lines} linhas)`);
          md.push(`Arquivo: ${r.file}`);
          md.push('```js');
          md.push(r.snippet.trim());
            md.push('```');
        });
        if (metrics.potentialRefactors.length > 20) {
          md.push(`_... ${metrics.potentialRefactors.length - 20} outros itens omitidos ..._`);
        }
      } else {
        md.push('_Nenhuma oportunidade de refatoração identificada pelas heurísticas simples._');
      }
      md.push('');
      md.push('## Notas');
      md.push('- Este relatório usa heurísticas simples e não substitui uma análise estática completa.');
      md.push('- Os padrões aprendidos são baseados em fragmentos observados recentemente.');
      const doc = await vscode.workspace.openTextDocument({ content: md.join('\n'), language: 'markdown' });
      await vscode.window.showTextDocument(doc, { preview: false });
    })
  );


  // Comando: scan workspace para seed inicial
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.scanWorkspace', async () => {
      const files = await vscode.workspace.findFiles('**/*.{js,ts}','**/node_modules/**',50);
      if (!files.length) {
        vscode.window.showInformationMessage('Nenhum arquivo JS/TS encontrado para scan.');
        return;
      }
      let processed = 0;
      for (const uri of files) {
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          // Força processamento
          await (learningSystem as any).processCodeFragment(doc);
          processed++;
        } catch(err) {
          console.log('[SimpleAI] Erro ao escanear', uri.fsPath, err);
        }
      }
      vscode.window.showInformationMessage(`Scan concluído. Arquivos processados: ${processed}`);
    })
  );

  // Cleanup when extension is deactivated
  context.subscriptions.push({
    dispose: () => {
      learningSystem.stopLearning();
      predictiveAssistant.dispose();
    }
  });

  // Comandos para controlar predições
  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.acceptPrediction', () => {
      predictiveAssistant.acceptPrediction();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('simpleai.rejectPrediction', () => {
      predictiveAssistant.rejectPrediction();
    })
  );

  vscode.window.showInformationMessage('SimpleAI activated');
}


export function deactivate() {
  // noop
}
