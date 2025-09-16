import * as vscode from 'vscode';
import { AutonomousLearningSystem } from './autonomousLearning';

interface CodePrediction {
    codigoPredito: string;
    confianca: number;
    contexto: string;
    raciocinio: string;
    posicao: vscode.Position;
}

interface TypingPattern {
    sequencia: string[];
    timestamp: number;
    velocidade: number; // caracteres por segundo
    direcao: 'forward' | 'backward'; // digitando ou apagando
}

export class PredictiveCodeAssistant {
    private typingHistory: TypingPattern[] = [];
    private currentPrediction: CodePrediction | null = null;
    private predictionDecoration: vscode.TextEditorDecorationType;
    private documentChangeListener: vscode.Disposable | undefined;
    private lastCursorPosition: vscode.Position | undefined;
    private typingVelocity: number = 0;
    private isUserTyping: boolean = false;
    private typingTimeout: NodeJS.Timeout | undefined;

    constructor(
        private learningSystem: AutonomousLearningSystem
    ) {
        const config = vscode.workspace.getConfiguration('simpleai');
        const ghostColor = config.get<string>('predictionColor', '#8888ff90');
        this.predictionDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                // Usa themeColor se disponível, senão fallback fixo configurável
                color: ghostColor || new vscode.ThemeColor('editorGhostText.foreground'),
                fontStyle: 'italic',
                textDecoration: 'none',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
        });

        this.startPredictiveAssistance();
    }

    private startPredictiveAssistance(): void {
        // Monitora mudanças em tempo real
        this.documentChangeListener = vscode.workspace.onDidChangeTextDocument(
            (event) => this.onDocumentChange(event)
        );

        // Monitora mudanças de cursor
        vscode.window.onDidChangeTextEditorSelection(
            (event) => this.onCursorChange(event)
        );

        // Monitora editor ativo
        vscode.window.onDidChangeActiveTextEditor(
            (editor) => this.onActiveEditorChange(editor)
        );
    }

    private async onDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        if (!this.isCodeDocument(event.document)) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== event.document) {
            return;
        }

        // Analisa cada mudança
        for (const change of event.contentChanges) {
            await this.analyzeChange(change, editor);
        }

        // Atualiza predição em tempo real
        await this.updatePrediction(editor);
    }

    private async analyzeChange(
        change: vscode.TextDocumentContentChangeEvent,
        editor: vscode.TextEditor
    ): Promise<void> {
        const now = Date.now();
        
        // Detecta se está digitando ou apagando
        const isDeleting = change.text.length === 0 && change.rangeLength > 0;
        const isTyping = change.text.length > 0;

        if (isTyping || isDeleting) {
            // Calcula velocidade de digitação
            this.calculateTypingVelocity(change, now);
            
            // Registra padrão de digitação
            this.recordTypingPattern(change, now, isDeleting);
            
            // Marca que usuário está digitando
            this.isUserTyping = true;
            
            // Reset timeout de digitação
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }
            
            this.typingTimeout = setTimeout(() => {
                this.isUserTyping = false;
            }, 500);
        }
    }

    private calculateTypingVelocity(
        change: vscode.TextDocumentContentChangeEvent,
        timestamp: number
    ): void {
        const lastPattern = this.typingHistory[this.typingHistory.length - 1];
        
        if (lastPattern) {
            const timeDiff = timestamp - lastPattern.timestamp;
            const charCount = change.text.length || change.rangeLength;
            
            if (timeDiff > 0) {
                this.typingVelocity = (charCount / timeDiff) * 1000; // caracteres por segundo
            }
        }
    }

    private recordTypingPattern(
        change: vscode.TextDocumentContentChangeEvent,
        timestamp: number,
        isDeleting: boolean
    ): void {
        const pattern: TypingPattern = {
            sequencia: isDeleting ? ['DELETE'] : change.text.split(''),
            timestamp,
            velocidade: this.typingVelocity,
            direcao: isDeleting ? 'backward' : 'forward'
        };

        this.typingHistory.push(pattern);
        
        // Mantém apenas os últimos 50 padrões
        if (this.typingHistory.length > 50) {
            this.typingHistory.shift();
        }
    }

    private async onCursorChange(event: vscode.TextEditorSelectionChangeEvent): Promise<void> {
        const editor = event.textEditor;
        const position = editor.selection.active;

        // Se cursor mudou, atualiza predição
        if (!this.lastCursorPosition || !this.lastCursorPosition.isEqual(position)) {
            this.lastCursorPosition = position;
            await this.updatePrediction(editor);
        }
    }

    private async onActiveEditorChange(editor: vscode.TextEditor | undefined): Promise<void> {
        if (editor && this.isCodeDocument(editor.document)) {
            await this.updatePrediction(editor);
        } else {
            this.clearPrediction(editor);
        }
    }

    private async updatePrediction(editor: vscode.TextEditor): Promise<void> {
        const renderMode = vscode.workspace.getConfiguration('simpleai').get<string>('predictionRenderMode','inline');
        if (renderMode === 'inline') {
            // Inline mode delega exibição ao InlineCompletionProvider
            return;
        }
        if (!this.isUserTyping) {
            return; // Só prediz quando usuário não está digitando ativamente
        }

        try {
            const prediction = await this.generatePrediction(editor);
            
            if (prediction && prediction.confianca > 0.3) {
                await this.showPrediction(editor, prediction);
            } else {
                this.clearPrediction(editor);
            }
        } catch (error) {
            console.error('Erro ao gerar predição:', error);
        }
    }

    private async generatePrediction(editor: vscode.TextEditor): Promise<CodePrediction | null> {
        const document = editor.document;
        const position = editor.selection.active;
        
        // Analisa contexto atual
        const currentLine = document.lineAt(position.line).text;
        const contextCode = this.getContextCode(document, position);
        
        // Identifica padrão atual
        const currentPattern = this.identifyCurrentPattern(currentLine, contextCode);
        
        if (!currentPattern) {
            return null;
        }

        // Gera predição baseada no padrão
        const prediction = await this.predictNextCode(currentPattern, contextCode, position);
        
        return prediction;
    }

    private getContextCode(document: vscode.TextDocument, position: vscode.Position): string {
        // Pega 10 linhas antes e 5 depois para contexto
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(document.lineCount - 1, position.line + 5);
        
        const range = new vscode.Range(startLine, 0, endLine, 0);
        return document.getText(range);
    }

    private identifyCurrentPattern(currentLine: string, contextCode: string): string | null {
        const line = currentLine.trim();
        
        // Identifica padrões comuns
        if (line.startsWith('function ')) {
            return 'function_declaration';
        }
        
        if (line.startsWith('class ')) {
            return 'class_declaration';
        }
        
        if (line.match(/^(const|let|var)\s+\w+/)) {
            return 'variable_declaration';
        }
        
        if (line.includes('if (') || line.includes('if(')) {
            return 'conditional_statement';
        }
        
        if (line.includes('for (') || line.includes('for(')) {
            return 'loop_statement';
        }
        
        if (line.includes('.') && !line.includes('//')) {
            return 'method_call';
        }
        
        if (line.includes('{') && !line.includes('}')) {
            return 'block_opening';
        }
        
        // Analisa contexto para padrões mais complexos
        if (contextCode.includes('function') && line.includes('return')) {
            return 'return_statement';
        }
        
        return null;
    }

    private async predictNextCode(
        pattern: string,
        contextCode: string,
        position: vscode.Position
    ): Promise<CodePrediction | null> {
        let predictedCode = '';
        let confidence = 0;
        let reasoning = '';

        switch (pattern) {
            case 'function_declaration':
                const functionPrediction = await this.predictFunctionBody(contextCode);
                predictedCode = functionPrediction.code;
                confidence = functionPrediction.confidence;
                reasoning = 'Predizindo corpo da função baseado em padrões similares';
                break;

            case 'class_declaration':
                const classPrediction = await this.predictClassBody(contextCode);
                predictedCode = classPrediction.code;
                confidence = classPrediction.confidence;
                reasoning = 'Predizendo estrutura da classe baseado em padrões similares';
                break;

            case 'variable_declaration':
                const varPrediction = await this.predictVariableValue(contextCode);
                predictedCode = varPrediction.code;
                confidence = varPrediction.confidence;
                reasoning = 'Predizendo valor da variável baseado no contexto';
                break;

            case 'conditional_statement':
                predictedCode = ' {\n    // código aqui\n}';
                confidence = 0.8;
                reasoning = 'Predizindo bloco condicional';
                break;

            case 'loop_statement':
                predictedCode = ' {\n    // iteração aqui\n}';
                confidence = 0.8;
                reasoning = 'Predizindo bloco de loop';
                break;

            case 'method_call':
                const methodPrediction = await this.predictMethodChain(contextCode);
                predictedCode = methodPrediction.code;
                confidence = methodPrediction.confidence;
                reasoning = 'Predizindo encadeamento de métodos';
                break;

            case 'block_opening':
                const blockPrediction = await this.predictBlockContent(contextCode);
                predictedCode = blockPrediction.code;
                confidence = blockPrediction.confidence;
                reasoning = 'Predizendo conteúdo do bloco';
                break;

            case 'return_statement':
                const returnPrediction = await this.predictReturnValue(contextCode);
                predictedCode = returnPrediction.code;
                confidence = returnPrediction.confidence;
                reasoning = 'Predizendo valor de retorno';
                break;

            default:
                return null;
        }

        if (predictedCode && confidence > 0.3) {
            return {
                codigoPredito: predictedCode,
                confianca: confidence,
                contexto: pattern,
                raciocinio: reasoning,
                posicao: position
            };
        }

        return null;
    }

    private async predictFunctionBody(contextCode: string): Promise<{code: string, confidence: number}> {
        // Usa o sistema de aprendizado para encontrar funções similares
        const suggestions = await this.learningSystem.getSuggestionsForContext(
            vscode.window.activeTextEditor!.document,
            vscode.window.activeTextEditor!.selection.active,
            'function'
        );

        if (suggestions.length > 0) {
            const bestSuggestion = suggestions[0];
            // Extrai apenas o corpo da função
            const lines = bestSuggestion.code.split('\n');
            const bodyStart = lines.findIndex(line => line.includes('{'));
            const bodyEnd = lines.length - 1 - lines.slice().reverse().findIndex(line => line.includes('}'));
            
            if (bodyStart >= 0 && bodyEnd > bodyStart) {
                const body = lines.slice(bodyStart, bodyEnd + 1).join('\n');
                return {
                    code: body,
                    confidence: bestSuggestion.similarity || 0.5
                };
            }
        }

        // Predição genérica
        return {
            code: ' {\n    // implementação aqui\n    return result;\n}',
            confidence: 0.4
        };
    }

    private async predictClassBody(contextCode: string): Promise<{code: string, confidence: number}> {
        // Analisa classes similares no contexto
        const classMatch = contextCode.match(/class\s+\w+[^{]*{([^}]*)}/g);
        
        if (classMatch && classMatch.length > 0) {
            // Extrai padrão comum de classes
            return {
                code: ' {\n    constructor() {\n        // inicialização\n    }\n\n    method() {\n        // implementação\n    }\n}',
                confidence: 0.6
            };
        }

        return {
            code: ' {\n    constructor() {\n        // construtor\n    }\n}',
            confidence: 0.4
        };
    }

    private async predictVariableValue(contextCode: string): Promise<{code: string, confidence: number}> {
        // Analisa padrões de variáveis no contexto
        const varPatterns = contextCode.match(/(const|let|var)\s+\w+\s*=\s*([^;]+);/g);
        
        if (varPatterns && varPatterns.length > 0) {
            // Analisa tipos comuns
            const hasObjects = varPatterns.some(p => p.includes('{'));
            const hasArrays = varPatterns.some(p => p.includes('['));
            const hasStrings = varPatterns.some(p => p.includes('"') || p.includes("'"));
            
            if (hasObjects) {
                return {
                    code: ' = {\n    // propriedades\n};',
                    confidence: 0.7
                };
            }
            
            if (hasArrays) {
                return {
                    code: ' = [\n    // elementos\n];',
                    confidence: 0.7
                };
            }
            
            if (hasStrings) {
                return {
                    code: ' = "";',
                    confidence: 0.6
                };
            }
        }

        return {
            code: ' = null;',
            confidence: 0.3
        };
    }

    private async predictMethodChain(contextCode: string): Promise<{code: string, confidence: number}> {
        // Analisa encadeamentos de métodos comuns
        const chainPatterns = contextCode.match(/\.\w+\([^)]*\)/g);
        
        if (chainPatterns && chainPatterns.length > 0) {
            const commonMethods = ['map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every'];
            const hasArrayMethods = chainPatterns.some(p => 
                commonMethods.some(m => p.includes(m))
            );
            
            if (hasArrayMethods) {
                return {
                    code: '.map(item => item)',
                    confidence: 0.6
                };
            }
        }

        return {
            code: '.method()',
            confidence: 0.3
        };
    }

    private async predictBlockContent(contextCode: string): Promise<{code: string, confidence: number}> {
        // Analisa o tipo de bloco baseado no contexto
        const lastLines = contextCode.split('\n').slice(-5);
        const context = lastLines.join('\n').toLowerCase();
        
        if (context.includes('try')) {
            return {
                code: '\n    // código que pode gerar erro\n',
                confidence: 0.8
            };
        }
        
        if (context.includes('catch')) {
            return {
                code: '\n    console.error(error);\n',
                confidence: 0.8
            };
        }
        
        if (context.includes('if')) {
            return {
                code: '\n    // condição verdadeira\n',
                confidence: 0.7
            };
        }
        
        if (context.includes('for') || context.includes('while')) {
            return {
                code: '\n    // iteração\n',
                confidence: 0.7
            };
        }

        return {
            code: '\n    // código aqui\n',
            confidence: 0.4
        };
    }

    private async predictReturnValue(contextCode: string): Promise<{code: string, confidence: number}> {
        // Analisa função atual para predizer retorno
        const functionMatch = contextCode.match(/function\s+\w+\([^)]*\)[^{]*{([^}]*)$/);
        
        if (functionMatch) {
            const functionBody = functionMatch[1];
            
            // Analisa variáveis declaradas na função
            const variables = functionBody.match(/(const|let|var)\s+(\w+)/g);
            if (variables && variables.length > 0) {
                const lastVar = variables[variables.length - 1].split(' ').pop();
                return {
                    code: ` ${lastVar};`,
                    confidence: 0.7
                };
            }
            
            // Analisa tipo de função baseado no nome
            if (functionMatch[0].includes('validate')) {
                return {
                    code: ' true;',
                    confidence: 0.8
                };
            }
            
            if (functionMatch[0].includes('get') || functionMatch[0].includes('find')) {
                return {
                    code: ' result;',
                    confidence: 0.7
                };
            }
            
            if (functionMatch[0].includes('create') || functionMatch[0].includes('build')) {
                return {
                    code: ' newObject;',
                    confidence: 0.7
                };
            }
        }

        return {
            code: ' result;',
            confidence: 0.4
        };
    }

    private async showPrediction(editor: vscode.TextEditor, prediction: CodePrediction): Promise<void> {
        const renderMode = vscode.workspace.getConfiguration('simpleai').get<string>('predictionRenderMode','inline');
        if (renderMode === 'inline') {
            return; // não mostra decoration em modo inline
        }
        this.currentPrediction = prediction;
        
        // Calcula posição da predição
        const position = editor.selection.active;
        const range = new vscode.Range(position, position);
        
        // Aplica decoração com o código predito
        const cfg = vscode.workspace.getConfiguration('simpleai');
        const showLabel = cfg.get<boolean>('showPredictionLabel', true);
        const labelText = cfg.get<string>('predictionLabelText', '·SimpleAI·');
        const positionMode = cfg.get<string>('predictionLabelPosition', 'prefix');
        const bg = cfg.get<string>('predictionBackgroundColor', '');
        const showMeta = cfg.get<boolean>('showPredictionMeta', false);
        const meta = showMeta ? `(${Math.round(prediction.confianca * 100)}%)` : '';
        const spacer = ' ';
        const labelBlock = showLabel ? (positionMode === 'prefix' ? `${labelText}${meta?spacer+meta:''}${spacer}` : `${spacer}${labelText}${meta?spacer+meta:''}`) : '';
        const maxLen = vscode.workspace.getConfiguration('simpleai').get<number>('previewMaxLength', 80);
        const rawPred = prediction.codigoPredito.replace(/\s+/g, ' ').trim();
        const truncated = rawPred.length > maxLen ? rawPred.slice(0, maxLen) + '…' : rawPred;
        const visualBase = positionMode === 'prefix'
            ? `${labelBlock}${truncated}`
            : `${truncated}${labelBlock}`;
        // Remove caracteres de controle invisíveis que podem afetar parsing de temas/syntax highlighters
        const visualText = visualBase.replace(/[\u0000-\u001F\u007F]/g, '');

        const decoration: vscode.DecorationOptions = {
            range,
            renderOptions: {
                after: {
                    contentText: visualText,
                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                    fontStyle: 'italic',
                    backgroundColor: bg && bg.trim().length > 0 ? bg : undefined
                }
            }
        };
        
        editor.setDecorations(this.predictionDecoration, [decoration]);
    // Marca contexto para keybinding condicional do Tab
    vscode.commands.executeCommand('setContext', 'simpleai.predictionVisible', true);
        
        // Mostra informação na status bar
        vscode.window.setStatusBarMessage(
            `🔮 Predição: ${prediction.raciocinio} (${Math.round(prediction.confianca * 100)}%)`,
            3000
        );
    }

    private clearPrediction(editor: vscode.TextEditor | undefined): void {
        if (editor) {
            editor.setDecorations(this.predictionDecoration, []);
        }
        this.currentPrediction = null;
        vscode.commands.executeCommand('setContext', 'simpleai.predictionVisible', false);
    }

    private isCodeDocument(document: vscode.TextDocument): boolean {
        const codeExtensions = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp'];
        return codeExtensions.includes(document.languageId);
    }

    public acceptPrediction(): void {
        if (this.currentPrediction && vscode.window.activeTextEditor) {
            const editor = vscode.window.activeTextEditor;
            const position = editor.selection.active;
            const predictedText = this.currentPrediction.codigoPredito;
            
            console.log('[SimpleAI] acceptPrediction acionado');
            console.log('[SimpleAI] Posição cursor:', position.line, position.character);
            console.log('[SimpleAI] Texto predito:', JSON.stringify(predictedText));
            console.log('[SimpleAI] Tamanho do texto:', predictedText.length);

            // Se o widget de sugestões estiver aberto, não competir (usuário deve escolher explicitamente outro atalho)
            const suggestActive = (vscode as any).window.activeTextEditor && (vscode as any).window.visibleTextEditors.length > 0 && (vscode as any).window['suggestWidgetVisible'];
            if (suggestActive) {
                console.log('[SimpleAI] SugestWidget ativo - abortando aceitação para não conflitar');
                return;
            }
            
            // Pequeno delay para evitar corrida com providers de completion, sem fechar outros widgets
            // Usa uma abordagem mais robusta com timeout
            setTimeout(() => {
                editor.edit(editBuilder => {
                    // Insere o texto predito na posição atual do cursor
                    editBuilder.insert(position, predictedText);
                }).then(success => {
                    console.log('[SimpleAI] Inserção bem-sucedida:', success);
                    if (!success) {
                        console.error('[SimpleAI] Falha na inserção do texto predito');
                        // Fallback: inserção direta via snippet
                        editor.insertSnippet(new vscode.SnippetString(predictedText), position);
                    }
                });
                
                this.clearPrediction(editor);
            }, 50); // Pequeno delay para evitar conflitos
        } else {
            console.log('[SimpleAI] acceptPrediction chamado mas sem predição ativa ou editor');
        }
    }

    public rejectPrediction(): void {
        if (vscode.window.activeTextEditor) {
            this.clearPrediction(vscode.window.activeTextEditor);
        }
    }

    // Método leve usado pelo inlineCompletionProvider
    public async quickPrediction(document: vscode.TextDocument, position: vscode.Position): Promise<CodePrediction | null> {
        // Reusa lógica existente parcialmente simplificada
        const currentLine = document.lineAt(position.line).text;
        const contextCode = this.getContextCode(document, position);
        const pattern = this.identifyCurrentPattern(currentLine, contextCode);
        if (!pattern) return null;
        const prediction = await this.predictNextCode(pattern, contextCode, position);
        return prediction;
    }

    public dispose(): void {
        if (this.documentChangeListener) {
            this.documentChangeListener.dispose();
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.predictionDecoration.dispose();
    }
}