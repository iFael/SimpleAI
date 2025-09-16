import * as vscode from 'vscode';
import * as esprima from 'esprima';

export interface ProjectMetrics {
  totalFiles: number;
  totalLines: number;
  languageDistribution: Record<string, number>;
  functions: { name: string; lines: number; file: string }[];
  classes: { name: string; lines: number; file: string }[];
  averageFunctionSize: number;
  largestFunctions: { name: string; lines: number; file: string }[];
  potentialRefactors: { file: string; reason: string; lines: number; snippet: string }[];
}

/**
 * Analisa o workspace coletando métricas básicas de estrutura de código.
 * Foco inicial: JS/TS.
 */
export class ProjectAnalyzer {
  private maxFiles = 400; // limite de segurança

  public async collectMetrics(): Promise<ProjectMetrics> {
    const arquivos = await vscode.workspace.findFiles('**/*.{js,ts}','**/node_modules/**', this.maxFiles);
    let totalLinhas = 0;
    const distribuicaoLinguagem: Record<string, number> = {};
    const funcoes: ProjectMetrics['functions'] = [];
    const classes: ProjectMetrics['classes'] = [];
    const refatoracoesPotenciais: ProjectMetrics['potentialRefactors'] = [];

    for (const uri of arquivos) {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const lang = doc.languageId;
        distribuicaoLinguagem[lang] = (distribuicaoLinguagem[lang] || 0) + 1;
        totalLinhas += doc.lineCount;
        this.extractStructures(doc, funcoes, classes, refatoracoesPotenciais);
      } catch (err) {
        console.log('[SimpleAI][ProjectAnalyzer] Falha ao processar', uri.fsPath, err);
      }
    }

    const tamanhoMedioFuncao = funcoes.length ? (funcoes.reduce((a, f) => a + f.lines, 0) / funcoes.length) : 0;
    const maioresFuncoes = [...funcoes].sort((a,b) => b.lines - a.lines).slice(0, 10);

    return {
      totalFiles: arquivos.length,
      totalLines: totalLinhas,
      languageDistribution: distribuicaoLinguagem,
      functions: funcoes,
      classes,
      averageFunctionSize: parseFloat(tamanhoMedioFuncao.toFixed(2)),
      largestFunctions: maioresFuncoes,
      potentialRefactors: refatoracoesPotenciais
    };
  }

  private extractStructures(doc: vscode.TextDocument, funcoes: ProjectMetrics['functions'], classes: ProjectMetrics['classes'], refatoracoesPotenciais: ProjectMetrics['potentialRefactors']) {
    if (!['javascript','typescript'].includes(doc.languageId)) return;
    let ast: any;
    try {
      ast = esprima.parseScript(doc.getText(), { tolerant: true, loc: true, comment: false });
    } catch (e) {
      return; // ignora erros de parse
    }

    const visit = (node: any) => {
      switch (node.type) {
        case 'FunctionDeclaration': {
          if (node.loc) {
            const name = node.id?.name || '(anon)';
            const lines = node.loc.end.line - node.loc.start.line + 1;
            funcoes.push({ name, lines, file: doc.fileName });
            if (lines > 120) {
              refatoracoesPotenciais.push({ file: doc.fileName, reason: 'Função muito longa', lines, snippet: this.getSnippet(doc, node.loc.start.line -1, node.loc.end.line -1) });
            }
          }
          break;
        }
        case 'ClassDeclaration': {
          if (node.loc) {
            const name = node.id?.name || '(anon class)';
            const lines = node.loc.end.line - node.loc.start.line + 1;
            classes.push({ name, lines, file: doc.fileName });
            if (lines > 300) {
              refatoracoesPotenciais.push({ file: doc.fileName, reason: 'Classe muito longa', lines, snippet: this.getSnippet(doc, node.loc.start.line -1, node.loc.end.line -1) });
            }
          }
          break;
        }
        case 'IfStatement': {
          // Heurística: if aninhado profundo
          const depth = this.computeIfDepth(node, 0);
          if (depth >= 4 && node.loc) {
            const lines = node.loc.end.line - node.loc.start.line + 1;
            refatoracoesPotenciais.push({ file: doc.fileName, reason: `If aninhado (profundidade ${depth})`, lines, snippet: this.getSnippet(doc, node.loc.start.line -1, node.loc.end.line -1) });
          }
          break;
        }
        case 'TryStatement': {
          if (node.loc) {
            const lines = node.loc.end.line - node.loc.start.line + 1;
            if (lines > 80) {
              refatoracoesPotenciais.push({ file: doc.fileName, reason: 'Bloco try/catch extenso', lines, snippet: this.getSnippet(doc, node.loc.start.line -1, node.loc.end.line -1) });
            }
          }
          break;
        }
      }

      // visitar filhos
      for (const k in node) {
        const child = node[k];
        if (!child) continue;
        if (Array.isArray(child)) child.forEach(c => c && typeof c === 'object' && 'type' in c && visit(c));
        else if (typeof child === 'object' && 'type' in child) visit(child);
      }
    };

    visit(ast);
  }

  private computeIfDepth(node: any, current: number): number {
    if (!node || node.type !== 'IfStatement') return current;
    const thenDepth = this.computeIfDepth(node.consequent, current + 1);
    const elseDepth = this.computeIfDepth(node.alternate, current + 1);
    return Math.max(thenDepth, elseDepth);
  }

  private getSnippet(doc: vscode.TextDocument, startLine: number, endLine: number): string {
    const start = Math.max(0, startLine);
    const end = Math.min(doc.lineCount -1, endLine);
    const range = new vscode.Range(start, 0, end, 200);
    return doc.getText(range).split('\n').slice(0,15).join('\n'); // limita snippet
  }
}
