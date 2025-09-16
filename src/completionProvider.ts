import * as vscode from 'vscode';
import { SnippetStorage } from './snippetStorage';
import { PatternAnalyzer, SuggestedSnippet } from './patternAnalyzer';
import { AutonomousLearningSystem } from './autonomousLearning';

export class SimpleAICompletionProvider implements vscode.CompletionItemProvider {
    constructor(
        private storage: SnippetStorage,
        private analyzer: PatternAnalyzer,
        private learningSystem?: AutonomousLearningSystem
    ) {}

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.CompletionItem[]> {
        const items: vscode.CompletionItem[] = [];

        try {
            // Get saved snippets that match the language
            const savedSnippets = await this.getSavedSnippets(document.languageId);
            items.push(...savedSnippets);

            // Get context-aware suggestions
            const contextSnippets = await this.getContextualSuggestions(document, position);
            items.push(...contextSnippets);

            // Get autonomous learning suggestions (if available)
            if (this.learningSystem) {
                const currentLine = document.lineAt(position.line).text;
                const learnedSuggestions = await this.learningSystem.getSuggestionsForContext(
                    document, 
                    position, 
                    currentLine
                );
                
                // Convert learned suggestions to completion items
                const learnedItems = learnedSuggestions.map(suggestion => 
                    this.createCompletionItem(suggestion, 'learned')
                );
                items.push(...learnedItems);
            }

            return items;
        } catch (error) {
            console.error('Erro ao fornecer completions:', error);
            return items;
        }
    }

    private async getSavedSnippets(language: string): Promise<vscode.CompletionItem[]> {
        const snippets = await this.storage.listSnippets();
        return snippets
            .filter(s => !s.language || s.language === language)
            .map(s => this.createCompletionItem(s));
    }

    private async getContextualSuggestions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.CompletionItem[]> {
        const items: vscode.CompletionItem[] = [];

        try {
            // Analisar código atual para sugestões inteligentes
            const currentCode = document.getText(new vscode.Range(
                new vscode.Position(Math.max(0, position.line - 10), 0),
                position
            ));

            // Gerar sugestões baseadas em padrões
            const patternSuggestions = await this.analyzer.suggestSnippetFromCode(currentCode);
            if (patternSuggestions) {
                items.push(this.createCompletionItem(patternSuggestions, 'pattern'));
            }
        } catch (error) {
            console.error('Erro ao obter sugestões contextuais:', error);
        }

        return items;
    }

    private createCompletionItem(
        snippet: SuggestedSnippet,
        type: 'pattern' | 'saved' | 'learned' = 'saved',
        score?: number
    ): vscode.CompletionItem {
        const item = new vscode.CompletionItem(
            `SimpleAI: ${snippet.title || 'Trecho'}`,
            vscode.CompletionItemKind.Snippet
        );
        
        // Customize based on type
        switch (type) {
            case 'learned':
                item.detail = `🧠 ${snippet.description}`;
                item.sortText = `0_${snippet.similarity || 0}`.padStart(10, '0');
                break;
            case 'pattern':
                item.detail = `🔍 ${snippet.description}`;
                item.sortText = `1_${snippet.similarity || 0}`.padStart(10, '0');
                break;
            case 'saved':
                item.detail = `💾 ${snippet.description}`;
                item.sortText = `2_${score || 0}`.padStart(10, '0');
                break;
        }
        
        item.documentation = new vscode.MarkdownString()
            .appendCodeblock(snippet.code, snippet.language);
        item.insertText = new vscode.SnippetString(snippet.code);
        
        return item;
    }
}
