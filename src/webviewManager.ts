import * as vscode from 'vscode';
import { SnippetStorage } from './snippetStorage';
import { PatternAnalyzer } from './patternAnalyzer';

export class WebviewManager {
  // Comentado temporariamente até que os campos sejam usados
  constructor(_context: vscode.ExtensionContext, _storage: SnippetStorage, _analyzer: PatternAnalyzer) {}

  showHelp() {
    const panel = vscode.window.createWebviewPanel('simpleaiHelp', 'Ajuda SimpleAI', vscode.ViewColumn.One, {});
    panel.webview.html = this.getHelpHtml();
  }

  private getHelpHtml() {
    return `<!doctype html><html><body><h1>SimpleAI</h1><p>Ajuda e documentação aparecerão aqui.</p></body></html>`;
  }
}
