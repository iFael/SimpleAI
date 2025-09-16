import * as vscode from 'vscode';
import { PredictiveCodeAssistant } from './predictiveAssistant';

export class SimpleAIInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  constructor(private assistant: PredictiveCodeAssistant) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | undefined> {
    const cfg = vscode.workspace.getConfiguration('simpleai');
    if (cfg.get<string>('predictionRenderMode','inline') !== 'inline') return; // não atua neste modo

    const prediction = await this.assistant.quickPrediction(document, position);
    if (!prediction) return;

    return new vscode.InlineCompletionList([
      {
        insertText: prediction.codigoPredito,
        range: new vscode.Range(position, position),
        command: {
          title: 'SimpleAI: Predição baseada em padrões aprendidos',
          command: ''
        }
      }
    ]);
  }
}