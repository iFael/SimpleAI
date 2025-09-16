import * as vscode from 'vscode';
import * as CryptoJS from 'crypto-js';
import * as esprima from 'esprima';
import { SuggestedSnippet } from './patternAnalyzer';

const STORAGE_KEY = 'simpleai.snippets';
const ENCRYPTION_KEY_KEY = 'simpleai.encryptionKey';

export class SnippetStorage {
  private key: string;
  constructor(private context: vscode.ExtensionContext) {
    this.key = this.context.globalState.get(ENCRYPTION_KEY_KEY) as string || '';
    if (!this.key) {
      this.key = CryptoJS.lib.WordArray.random(16).toString();
      this.context.globalState.update(ENCRYPTION_KEY_KEY, this.key);
    }
  }

  private encrypt(obj: any) {
    const str = JSON.stringify(obj);
    return CryptoJS.AES.encrypt(str, this.key).toString();
  }

  private decrypt(payload: string) {
    try {
      const bytes = CryptoJS.AES.decrypt(payload, this.key);
      const text = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(text);
    } catch (err) {
      return [];
    }
  }

  async listSnippets(): Promise<SuggestedSnippet[]> {
    const raw = this.context.workspaceState.get<string>(STORAGE_KEY);
    if (!raw) { return []; }
    return this.decrypt(raw) as SuggestedSnippet[];
  }

  async saveSnippet(snippet: SuggestedSnippet) {
    const atual = await this.listSnippets();
    
    // Usar snippet diretamente, já que SuggestedSnippet tem a estrutura necessária
    const snippetMelhorado: SuggestedSnippet = {
      code: snippet.code,
      title: snippet.title,
      description: snippet.description,
      language: snippet.language || 'desconhecido',
      pattern: snippet.pattern,
      similarity: snippet.similarity
    };

    // Analisar código para extrair informações básicas
    if (snippet.code) {
      try {
        const ast = esprima.parseScript(snippet.code, { tolerant: true });
        this.extractMetadata(ast, snippetMelhorado);
      } catch (err) {
        console.warn('Erro ao analisar snippet:', err);
      }
    }

    atual.push(snippet);
    const enc = this.encrypt(atual);
    await this.context.workspaceState.update(STORAGE_KEY, enc);
  }

  private extractMetadata(ast: any, snippet: SuggestedSnippet): void {
    // Método simplificado - apenas atualiza descrição se não existir
    if (!snippet.description) {
      // Gerar descrição básica baseada no código
      if (snippet.code.includes('function')) {
        snippet.description = 'Função JavaScript/TypeScript';
      } else if (snippet.code.includes('class')) {
        snippet.description = 'Classe JavaScript/TypeScript';
      } else if (snippet.code.includes('const') || snippet.code.includes('let')) {
        snippet.description = 'Declaração de variável';
      } else {
        snippet.description = 'Snippet de código';
      }
    }
  }

  async deleteSnippet(snippet: SuggestedSnippet): Promise<boolean> {
    const atual = await this.listSnippets();
    const indice = atual.findIndex(s => 
      s.code === snippet.code && 
      s.language === snippet.language &&
      s.title === snippet.title &&
      s.description === snippet.description
    );
    
    if (indice === -1) {
      return false;
    }

    atual.splice(indice, 1);
    const enc = this.encrypt(atual);
    await this.context.workspaceState.update(STORAGE_KEY, enc);
    return true;
  }
}
