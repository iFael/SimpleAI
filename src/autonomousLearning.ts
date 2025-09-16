import * as vscode from 'vscode';
import { PatternAnalyzer, SuggestedSnippet } from './patternAnalyzer';
import { Program, Node, FunctionDeclaration, ClassDeclaration, VariableDeclaration } from 'estree';

interface LearnedPattern {
    id: string;
    codigo: string;
    contexto: string;
    frequencia: number;
    ultimoUso: Date;
    gatilhos: string[]; // Palavras-chave que disparam esta sugestão
    tipoArquivo: string;
    confianca: number; // 0-1, quão confiante estamos neste padrão
    variacoes: string[]; // Variações do mesmo padrão
}

interface CodeFragment {
    content: string;
    type: 'funcao' | 'classe' | 'variavel' | 'bloco' | 'importacao' | 'loop' | 'condicao';
    context: string;
    lineCount: number;
    complexity: number;
}

export class AutonomousLearningSystem {
    private learnedPatterns: Map<string, LearnedPattern> = new Map();
    private documentChangeListener: vscode.Disposable | undefined;
    private typingBuffer: string = '';
    private lastTypingTime: number = 0;
    private readonly TYPING_PAUSE_MS = 1500; // Reduz para reagir mais rápido
    private readonly MIN_PATTERN_LENGTH = 12; // Reduz para aprender mais cedo
    private readonly MAX_PATTERNS = 1000; // Máximo de padrões armazenados
    // Estatísticas e eventos removidos para versão simplificada
    
    constructor(
        private context: vscode.ExtensionContext,
        private analyzer: PatternAnalyzer
    ) {
        this.loadLearnedPatterns();
        this.startLearning();
    }

    /**
     * Inicia o sistema de aprendizado automático
     */
    public startLearning(): void {
        // Monitora mudanças em todos os documentos
        this.documentChangeListener = vscode.workspace.onDidChangeTextDocument(
            (event) => this.onDocumentChange(event)
        );
        this.log('[Aprendizado] Sistema iniciado');

        // Também monitora quando o usuário para de digitar
        setInterval(() => this.processTypingBuffer(), 1000);
    }

    /**
     * Para o sistema de aprendizado
     */
    public stopLearning(): void {
        if (this.documentChangeListener) {
            this.documentChangeListener.dispose();
        }
    }

    /**
     * Processa mudanças no documento em tempo real
     */
    private async onDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        // Ignora documentos que não são código
        if (!this.isCodeDocument(event.document)) {
            return;
        }

        // Acumula as mudanças no buffer
        for (const change of event.contentChanges) {
            if (change.text.length > 0) {
                this.typingBuffer += change.text;
                this.lastTypingTime = Date.now();
                if (change.text.includes('\n')) {
                    this.log(`[Digitação] Quebra de linha detectada. Tamanho buffer=${this.typingBuffer.length}`);
                }
            }
        }

        // Se o usuário fez uma mudança significativa, processa imediatamente
        if (event.contentChanges.some(change => 
            change.text.includes('\n') || 
            change.text.includes(';') || 
            change.text.includes('}')
        )) {
            this.log('[Gatilho] Mudança significativa detectada. Processando fragmento...');
            await this.processCodeFragment(event.document);
        }
    }

    /**
     * Processa o buffer de digitação quando o usuário para de digitar
     */
    private async processTypingBuffer(): Promise<void> {
        const agora = Date.now();
        
        // Se o usuário parou de digitar há mais de 2 segundos
        if (this.typingBuffer.length > 0 && (agora - this.lastTypingTime) > this.TYPING_PAUSE_MS) {
            const editorAtivo = vscode.window.activeTextEditor;
            if (editorAtivo && this.isCodeDocument(editorAtivo.document)) {
                await this.processCodeFragment(editorAtivo.document);
            }
            this.typingBuffer = '';
        }
    }

    /**
     * Processa um fragmento de código e extrai padrões
     */
    private async processCodeFragment(document: vscode.TextDocument): Promise<void> {
        try {
            const fragmentos = await this.extractCodeFragments(document);
            this.log(`[Extração] ${fragmentos.length} fragmentos extraídos do documento ${document.fileName}`);
            
            for (const fragmento of fragmentos) {
                const vale = this.isWorthLearning(fragmento);
                if (vale) {
                    await this.learnFromFragment(fragmento, document);
                } else {
                    this.log(`[Skip] Fragmento ignorado. Motivo=${this.reasonNotWorth(fragmento)}`);
                }
            }
            
            await this.saveLearnedPatterns();
        } catch (error) {
            console.error('Erro ao processar fragmento de código:', error);
        }
    }

    /**
     * Extrai fragmentos interessantes do código
     */
    private async extractCodeFragments(document: vscode.TextDocument): Promise<CodeFragment[]> {
        const fragmentos: CodeFragment[] = [];
        const ast = await this.analyzer.analyzeDocument(document);
        
        if (!ast) {
            this.log('[Extract] AST nula - possivelmente erro de parse ou linguagem não suportada');
            return fragmentos;
        }

        // Extrai funções completas
        this.extractFunctions(ast, fragmentos, document);
        
        // Extrai classes
        this.extractClasses(ast, fragmentos, document);
        
        // Extrai variáveis interessantes
        this.extractVariables(ast, fragmentos, document);
        
        // Extrai imports úteis
        this.extractImports(ast, fragmentos, document);
        
    // Extrai blocos de código interessantes (loops, condicionais)
    this.extractBlocks(ast, fragmentos, document);

        return fragmentos;
    }

    private extractFunctions(ast: Program, fragmentos: CodeFragment[], document: vscode.TextDocument): void {
        const visitar = (node: Node) => {
            if (node.type === 'FunctionDeclaration') {
                const funcao = node as FunctionDeclaration;
                if (funcao.loc && funcao.id?.name) {
                    const inicio = funcao.loc.start.line - 1;
                    const fim = funcao.loc.end.line - 1;
                    const range = new vscode.Range(inicio, 0, fim, 0);
                    const conteudo = document.getText(range);
                    
                    fragmentos.push({
                        content: conteudo,
                        type: 'funcao',
                        context: this.extractContext(document, inicio),
                        lineCount: fim - inicio + 1,
                        complexity: this.calculateComplexity(conteudo)
                    });
                }
            }

            // Visita nós filhos
            for (const chave in node) {
                const filho = (node as any)[chave];
                if (filho && typeof filho === 'object') {
                    if (Array.isArray(filho)) {
                        filho.forEach(item => {
                            if (item && typeof item === 'object' && 'type' in item) {
                                visitar(item);
                            }
                        });
                    } else if ('type' in filho) {
                        visitar(filho);
                    }
                }
            }
        };

        visitar(ast);
    }

    private extractClasses(ast: Program, fragmentos: CodeFragment[], document: vscode.TextDocument): void {
        const visitar = (node: Node) => {
            if (node.type === 'ClassDeclaration') {
                const classe = node as ClassDeclaration;
                if (classe.loc && classe.id?.name) {
                    const inicio = classe.loc.start.line - 1;
                    const fim = classe.loc.end.line - 1;
                    const range = new vscode.Range(inicio, 0, fim, 0);
                    const conteudo = document.getText(range);
                    
                    fragmentos.push({
                        content: conteudo,
                        type: 'classe',
                        context: this.extractContext(document, inicio),
                        lineCount: fim - inicio + 1,
                        complexity: this.calculateComplexity(conteudo)
                    });
                }
            }

            // Visita nós filhos
            for (const chave in node) {
                const filho = (node as any)[chave];
                if (filho && typeof filho === 'object') {
                    if (Array.isArray(filho)) {
                        filho.forEach(item => {
                            if (item && typeof item === 'object' && 'type' in item) {
                                visitar(item);
                            }
                        });
                    } else if ('type' in filho) {
                        visitar(filho);
                    }
                }
            }
        };

        visitar(ast);
    }

    private extractVariables(ast: Program, fragmentos: CodeFragment[], document: vscode.TextDocument): void {
        const visit = (node: Node) => {
            if (node.type === 'VariableDeclaration') {
                const varDecl = node as VariableDeclaration;
                if (varDecl.loc) {
                    const start = varDecl.loc.start.line - 1;
                    const end = varDecl.loc.end.line - 1;
                    const range = new vscode.Range(start, 0, end, 0);
                    const content = document.getText(range).trim();
                    
                    // Só aprende variáveis interessantes (objetos, arrays, funções)
                    if (this.isInterestingVariable(content)) {
                        fragmentos.push({
                            content,
                            type: 'variavel',
                            context: this.extractContext(document, start),
                            lineCount: end - start + 1,
                            complexity: this.calculateComplexity(content)
                        });
                    }
                }
            }

            // Visita nós filhos
            for (const key in node) {
                const child = (node as any)[key];
                if (child && typeof child === 'object') {
                    if (Array.isArray(child)) {
                        child.forEach(item => {
                            if (item && typeof item === 'object' && 'type' in item) {
                                visit(item);
                            }
                        });
                    } else if ('type' in child) {
                        visit(child);
                    }
                }
            }
        };

        visit(ast);
    }

    private extractImports(ast: Program, fragmentos: CodeFragment[], document: vscode.TextDocument): void {
        const visit = (node: Node) => {
            if (node.type === 'ImportDeclaration') {
                if (node.loc) {
                    const start = node.loc.start.line - 1;
                    const end = node.loc.end.line - 1;
                    const range = new vscode.Range(start, 0, end, 0);
                    const content = document.getText(range).trim();
                    
                    fragmentos.push({
                        content,
                        type: 'importacao',
                        context: 'file-start',
                        lineCount: 1,
                        complexity: 1
                    });
                }
            }

            // Visita nós filhos
            for (const key in node) {
                const child = (node as any)[key];
                if (child && typeof child === 'object') {
                    if (Array.isArray(child)) {
                        child.forEach(item => {
                            if (item && typeof item === 'object' && 'type' in item) {
                                visit(item);
                            }
                        });
                    } else if ('type' in child) {
                        visit(child);
                    }
                }
            }
        };

        visit(ast);
    }

    private extractBlocks(ast: Program, fragmentos: CodeFragment[], document: vscode.TextDocument): void {
        const visit = (node: Node) => {
            const blockTypes: {type: string; match: (n: Node) => boolean;}[] = [
                { type: 'loop', match: n => ['ForStatement','WhileStatement','DoWhileStatement','ForInStatement','ForOfStatement'].includes(n.type) },
                { type: 'condicao', match: n => n.type === 'IfStatement' },
                { type: 'bloco', match: n => n.type === 'TryStatement' }
            ];

            for (const bt of blockTypes) {
                if (bt.match(node) && (node as any).loc) {
                    const loc = (node as any).loc;
                    const start = loc.start.line - 1;
                    const end = Math.min(document.lineCount - 1, loc.end.line - 1);
                    if (end > start && end - start + 1 <= 40) {
                        const range = new vscode.Range(start, 0, end, 0);
                        const content = document.getText(range);
                        if (content.length >= this.MIN_PATTERN_LENGTH) {
                            fragmentos.push({
                                content,
                                type: bt.type as any,
                                context: this.extractContext(document, start),
                                lineCount: end - start + 1,
                                complexity: this.calculateComplexity(content)
                            });
                        }
                    }
                }
            }
            // visitar filhos
            for (const key in node) {
                const child = (node as any)[key];
                if (child && typeof child === 'object') {
                    if (Array.isArray(child)) child.forEach(c => c && typeof c === 'object' && 'type' in c && visit(c));
                    else if ('type' in child) visit(child);
                }
            }
        };
        visit(ast);
    }

    /**
     * Verifica se vale a pena aprender com este fragmento
     */
    private isWorthLearning(fragment: CodeFragment): boolean {
        // Regras afrouxadas para estágio inicial
        if (fragment.content.length < this.MIN_PATTERN_LENGTH) return false;
        if (fragment.lineCount > 50) return false;
        if (fragment.complexity < 1) return false;
        const similar = this.findSimilarPattern(fragment.content);
        if (similar && similar.confianca > 0.9) return false;
        return true;
    }

    private reasonNotWorth(fragment: CodeFragment): string {
        if (fragment.content.length < this.MIN_PATTERN_LENGTH) return 'curto';
        if (fragment.lineCount > 50) return 'longo';
        if (fragment.complexity < 1) return 'complexidade';
        const similar = this.findSimilarPattern(fragment.content);
        if (similar && similar.confianca > 0.9) return 'similar-existente';
        return 'desconhecido';
    }

    /**
     * Aprende com um fragmento de código
     */
    private async learnFromFragment(fragment: CodeFragment, document: vscode.TextDocument): Promise<void> {
        const patternId = this.generatePatternId(fragment.content);
        const existing = this.learnedPatterns.get(patternId);

        if (existing) {
            // Incrementa frequência do padrão existente
            existing.frequencia++;
            existing.ultimoUso = new Date();
            
            // Adiciona variação se for ligeiramente diferente
            if (!existing.variacoes.includes(fragment.content)) {
                existing.variacoes.push(fragment.content);
            }
        } else {
            // Cria novo padrão aprendido
            const triggers = this.extractTriggers(fragment.content, fragment.context);
            const confidence = this.calculatePatternConfidence(fragment);

            const newPattern: LearnedPattern = {
                id: patternId,
                codigo: fragment.content,
                contexto: fragment.context,
                frequencia: 1,
                ultimoUso: new Date(),
                gatilhos: triggers,
                tipoArquivo: document.languageId,
                confianca: confidence,
                variacoes: []
            };

            this.learnedPatterns.set(patternId, newPattern);
            this.log(`[Learn] Novo padrão aprendido id=${patternId} tipo=${fragment.type} len=${fragment.content.length} conf=${confidence.toFixed(2)}`);
            
            // Limita o número de padrões armazenados
            if (this.learnedPatterns.size > this.MAX_PATTERNS) {
                this.cleanupOldPatterns();
            }
        }
    }

    /**
     * Extrai triggers (palavras-chave) que podem disparar este padrão
     */
    private extractTriggers(code: string, context: string): string[] {
        const triggers: string[] = [];
        
        // Extrai palavras-chave do código
        const keywords = code.match(/\b(function|class|const|let|var|if|for|while|return|import|export)\b/g) || [];
        triggers.push(...keywords);
        
        // Extrai nomes de funções e variáveis
        const names = code.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
        triggers.push(...names.slice(0, 5)); // Limita a 5 nomes
        
        // Extrai do contexto
        const contextWords = context.split(/\s+/).filter(word => word.length > 3);
        triggers.push(...contextWords.slice(0, 3));
        
        return [...new Set(triggers)]; // Remove duplicatas
    }

    /**
     * Calcula a confiança de um padrão baseado em sua qualidade
     */
    private calculatePatternConfidence(fragment: CodeFragment): number {
        let confidence = 0.5; // Base

        // Fragmentos mais complexos são mais confiáveis
        confidence += Math.min(0.3, fragment.complexity * 0.1);
        
        // Funções e classes são mais confiáveis que variáveis
        switch (fragment.type) {
            case 'funcao':
                confidence += 0.2;
                break;
            case 'classe':
                confidence += 0.25;
                break;
            case 'importacao':
                confidence += 0.15;
                break;
        }

        // Código com boa estrutura é mais confiável
        if (this.hasGoodStructure(fragment.content)) {
            confidence += 0.1;
        }

        return Math.min(1, confidence);
    }

    /**
     * Busca padrões similares baseados no contexto atual
     */
    public async getSuggestionsForContext(
        document: vscode.TextDocument, 
        position: vscode.Position,
        currentLine: string
    ): Promise<SuggestedSnippet[]> {
    const suggestions: SuggestedSnippet[] = [];
        const context = this.extractContext(document, position.line);
        
        // Analisa o que o usuário está digitando
        const typingContext = this.analyzeTypingContext(currentLine, context);
        
        for (const pattern of this.learnedPatterns.values()) {
            const relevance = this.calculateRelevance(pattern, typingContext, document.languageId);
            
            if (relevance > 0.3) { // Threshold de relevância
                suggestions.push({
                    title: this.generateSuggestionTitle(pattern),
                    description: `Padrão aprendido (${Math.round(relevance * 100)}% relevante, usado ${pattern.frequencia}x)`,
                    language: pattern.tipoArquivo,
                    code: pattern.codigo,
                    similarity: relevance
                });
            }
        }

        // Ordena por relevância
        suggestions.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
        
        const result = suggestions.slice(0, 5);
        if (result.length) {
            this.log(`[Suggest] ${result.length} sugestões geradas (top similarity=${(result[0].similarity||0).toFixed(2)})`);
        }
        return result; // Retorna top 5
    }

    /**
     * Analisa o contexto de digitação atual
     */
    private analyzeTypingContext(currentLine: string, context: string): string[] {
        const words: string[] = [];
        
        // Palavras da linha atual
        words.push(...currentLine.split(/\s+/).filter(w => w.length > 2));
        
        // Palavras do contexto
        words.push(...context.split(/\s+/).filter(w => w.length > 2));
        
        return [...new Set(words)];
    }

    /**
     * Calcula a relevância de um padrão para o contexto atual
     */
    private calculateRelevance(pattern: LearnedPattern, typingContext: string[], language: string): number {
        let relevance = 0;

        // Compatibilidade de linguagem
        if (pattern.tipoArquivo === language) {
            relevance += 0.2;
        }

        // Confiança do padrão
        relevance += pattern.confianca * 0.3;

        // Frequência de uso (normalizada)
        relevance += Math.min(0.2, pattern.frequencia * 0.02);

        // Correspondência de triggers
        const matchingTriggers = pattern.gatilhos.filter((trigger: string) => 
            typingContext.some(word => word.includes(trigger) || trigger.includes(word))
        ).length;
        
        if (pattern.gatilhos.length > 0) {
            relevance += (matchingTriggers / pattern.gatilhos.length) * 0.3;
        }

        return Math.min(1, relevance);
    }

    // Métodos auxiliares
    private isCodeDocument(document: vscode.TextDocument): boolean {
        const codeExtensions = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp'];
        return codeExtensions.includes(document.languageId);
    }

    private isInterestingVariable(content: string): boolean {
        return content.includes('{') || content.includes('[') || content.includes('=>') || content.includes('function');
    }

    private extractContext(document: vscode.TextDocument, line: number): string {
        const start = Math.max(0, line - 3);
        const end = Math.min(document.lineCount - 1, line + 3);
        const range = new vscode.Range(start, 0, end, 0);
        return document.getText(range);
    }

    private calculateComplexity(code: string): number {
        let complexity = 1;
        
        // Conta estruturas de controle
        complexity += (code.match(/(if|else|for|while|switch|try|catch)/g) || []).length;
        
        // Conta funções aninhadas
        complexity += (code.match(/function|=>/g) || []).length;
        
        // Conta objetos e arrays complexos
        complexity += (code.match(/[{[]/g) || []).length * 0.5;
        
        return complexity;
    }

    private hasGoodStructure(code: string): boolean {
        // Verifica se tem boa indentação e estrutura
        const lines = code.split('\n');
        let indentationConsistent = true;
        let braceBalance = 0;
        
        for (const line of lines) {
            braceBalance += (line.match(/{/g) || []).length;
            braceBalance -= (line.match(/}/g) || []).length;
        }
        
        return indentationConsistent && braceBalance === 0;
    }

    private generatePatternId(code: string): string {
        // Gera um ID único baseado no hash do código normalizado
        const normalized = code.replace(/\s+/g, ' ').trim();
        return `pattern_${this.simpleHash(normalized)}`;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    private findSimilarPattern(code: string): LearnedPattern | null {
        // Implementação simples de busca por similaridade
        for (const pattern of this.learnedPatterns.values()) {
            if (this.calculateCodeSimilarity(code, pattern.codigo) > 0.8) {
                return pattern;
            }
        }
        return null;
    }

    private calculateCodeSimilarity(code1: string, code2: string): number {
        // Implementação simples usando Jaccard similarity
        const set1 = new Set(code1.split(/\s+/));
        const set2 = new Set(code2.split(/\s+/));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }

    private generateSuggestionTitle(pattern: LearnedPattern): string {
        const lines = pattern.codigo.split('\n');
        const firstLine = lines[0].trim();
        
        if (firstLine.includes('function')) {
            const match = firstLine.match(/function\s+(\w+)/);
            return match ? `Função: ${match[1]}` : 'Função aprendida';
        }
        
        if (firstLine.includes('class')) {
            const match = firstLine.match(/class\s+(\w+)/);
            return match ? `Classe: ${match[1]}` : 'Classe aprendida';
        }
        
        if (firstLine.includes('const') || firstLine.includes('let') || firstLine.includes('var')) {
            const match = firstLine.match(/(const|let|var)\s+(\w+)/);
            return match ? `Variável: ${match[2]}` : 'Variável aprendida';
        }
        
        return firstLine.slice(0, 30) + (firstLine.length > 30 ? '...' : '');
    }

    private cleanupOldPatterns(): void {
        // Remove padrões menos usados e mais antigos
        const patterns = Array.from(this.learnedPatterns.entries());
        patterns.sort((a, b) => {
            const scoreA = a[1].frequencia * a[1].confianca;
            const scoreB = b[1].frequencia * b[1].confianca;
            return scoreB - scoreA;
        });
        
        // Mantém apenas os top 80%
        const keepCount = Math.floor(this.MAX_PATTERNS * 0.8);
        this.learnedPatterns.clear();
        
        for (let i = 0; i < keepCount && i < patterns.length; i++) {
            this.learnedPatterns.set(patterns[i][0], patterns[i][1]);
        }
    }

    private async loadLearnedPatterns(): Promise<void> {
        try {
            const saved = this.context.globalState.get<Record<string, LearnedPattern>>('learnedPatterns', {});
            this.learnedPatterns = new Map(Object.entries(saved));
        } catch (error) {
            console.error('Erro ao carregar padrões aprendidos:', error);
        }
    }

    private async saveLearnedPatterns(): Promise<void> {
        try {
            const obj = Object.fromEntries(this.learnedPatterns);
            await this.context.globalState.update('learnedPatterns', obj);
            this.log(`[Persist] ${this.learnedPatterns.size} padrões salvos`);
        } catch (error) {
            console.error('Erro ao salvar padrões aprendidos:', error);
        }
    }

    // Logging substituído por no-op para simplificar versão sem estatísticas
    private log(_msg: string) { /* estatísticas removidas */ }

    /** Retorna os top N padrões por frequência (default 10) */
    public getTopPatterns(limit = 10): { id: string; frequency: number; firstLine: string; confidence: number }[] {
        return Array.from(this.learnedPatterns.values())
            .sort((a,b) => b.frequencia - a.frequencia)
            .slice(0, limit)
            .map(p => ({
                id: p.id,
                frequency: p.frequencia,
                firstLine: p.codigo.split('\n')[0].trim().slice(0,120),
                confidence: p.confianca
            }));
    }
}