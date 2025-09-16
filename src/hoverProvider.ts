import * as vscode from 'vscode';
import { SnippetStorage } from './snippetStorage';
import { PatternAnalyzer, SuggestedSnippet } from './patternAnalyzer';

export class SimpleAIHoverProvider implements vscode.HoverProvider {
    constructor(
        private storage: SnippetStorage,
        private analyzer: PatternAnalyzer
    ) {}

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        try {
            // Get the code range under the cursor
            const range = this.getHoverRange(document, position);
            if (!range) { return undefined; }

            const codeUnderCursor = document.getText(range);
            
            // 1. Check for exact matches in saved snippets
            const snippetMatch = await this.findMatchingSnippet(codeUnderCursor, document.languageId);
            if (snippetMatch) {
                return this.createSnippetHover(snippetMatch, range);
            }

            // 2. Analyze code pattern if no exact match
            const suggestion = await this.analyzer.suggestSnippetFromCode(codeUnderCursor);
            if (suggestion && suggestion.similarity && suggestion.similarity > 0.5) {
                return this.createPatternHover(suggestion, range);
            }

            return undefined;
        } catch (error) {
            console.error('Erro ao fornecer hover:', error);
            return undefined;
        }
    }

    private getHoverRange(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Range | undefined {
        // First try to get the word range
        const wordRange = document.getWordRangeAtPosition(position);
        if (wordRange) { return wordRange; }

        // If no word, try to get the statement or declaration
        const line = document.lineAt(position.line);
        
        // Simple heuristic: if we're in a function/class declaration,
        // include surrounding lines
        const text = line.text.trim();
        if (text.startsWith('function') || text.startsWith('class') || text.includes('{')) {
            const startLine = Math.max(0, position.line - 2);
            const endLine = Math.min(document.lineCount - 1, position.line + 2);
            
            return new vscode.Range(
                new vscode.Position(startLine, 0),
                new vscode.Position(endLine, document.lineAt(endLine).text.length)
            );
        }

        // Default to current line
        return line.range;
    }

    private async findMatchingSnippet(
        code: string,
        language: string
    ): Promise<SuggestedSnippet | undefined> {
        const snippets = await this.storage.listSnippets();
        return snippets.find(s => 
            (!s.language || s.language === language) &&
            (s.code.trim() === code.trim() || s.title === code.trim())
        );
    }

    private createSnippetHover(
        snippet: SuggestedSnippet,
        range: vscode.Range
    ): vscode.Hover {
        const contents: vscode.MarkdownString[] = [];
        
        // Title and description
        contents.push(new vscode.MarkdownString()
            .appendMarkdown(`**${snippet.title || 'Snippet Match'}**\n\n`)
            .appendMarkdown(`${snippet.description || 'Saved snippet'}\n\n`)
        );

        // Code preview
        contents.push(new vscode.MarkdownString()
            .appendCodeblock(snippet.code, snippet.language)
        );

        // Usage hints
        contents.push(new vscode.MarkdownString()
            .appendMarkdown('\n*Press `Tab` to insert this snippet*')
        );

        return new vscode.Hover(contents, range);
    }

    private createPatternHover(
        suggestion: SuggestedSnippet,
        range: vscode.Range
    ): vscode.Hover {
        const contents: vscode.MarkdownString[] = [];
        
        // Pattern information
        contents.push(new vscode.MarkdownString()
            .appendMarkdown(`**Similar Pattern Found**\n\n`)
            .appendMarkdown(`${suggestion.description}\n\n`)
            .appendMarkdown(`Pattern Match: ${Math.round((suggestion.similarity || 0) * 100)}%\n\n`)
        );

        // Suggestions if highly similar
        if (suggestion.similarity && suggestion.similarity > 0.8) {
            contents.push(new vscode.MarkdownString()
                .appendMarkdown('**💡 Suggestion**: Consider creating a reusable snippet\n\n')
                .appendMarkdown('*Use `SimpleAI: Create Snippet from Selection` to save this pattern*')
            );
        }

        return new vscode.Hover(contents, range);
    }
}
