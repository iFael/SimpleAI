import * as vscode from 'vscode';
import * as esprima from 'esprima';
import { Program, Node, FunctionDeclaration, ClassDeclaration, VariableDeclaration } from 'estree';

export interface SuggestedSnippet {
    title?: string;
    description?: string;
    language?: string;
    code: string;
    pattern?: string;
    similarity?: number;
}

interface PatternMatch {
    node: Node;
    score: number;
    type: string;
}

export class PatternAnalyzer {
    private patterns: Map<string, Node[]> = new Map();
    
    constructor(context: vscode.ExtensionContext) {
        // Contexto será usado em implementações futuras
    }

    async analyzeDocument(document: vscode.TextDocument): Promise<Program | null> {
        const language = document.languageId;
        
        if (!['javascript', 'typescript'].includes(language)) {
            return null; // TODO: Add support for more languages
        }

        try {
            const code = document.getText();
            const ast = esprima.parseScript(code, { 
                tolerant: true, 
                loc: true,
                comment: true,
                tokens: true
            });
            
            // Store patterns found in this document
            this.extractPatterns(ast);
            
            return ast;
        } catch (err) {
            console.error('Erro ao analisar documento:', err);
            return null;
        }
    }

    public extractPatterns(ast: Program): void {
        const visit = (node: Node) => {
            switch (node.type) {
                case 'FunctionDeclaration':
                case 'ClassDeclaration':
                case 'VariableDeclaration':
                    this.storePattern(node);
                    break;
            }

            for (const key in node) {
                const child = (node as any)[key];
                if (child && typeof child === 'object') {
                    if (Array.isArray(child)) {
                        child.forEach(item => {
                            if (item && typeof item === 'object') {
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

    private storePattern(node: Node): void {
        const type = node.type;
        if (!this.patterns.has(type)) {
            this.patterns.set(type, []);
        }
        this.patterns.get(type)?.push(node);
    }

    async suggestSnippetFromCode(code: string): Promise<SuggestedSnippet> {
        try {
            const ast = esprima.parseScript(code, { 
                tolerant: true, 
                loc: true,
                comment: true 
            });
            
            if (!ast.body[0]) {
                return this.createBasicSnippet(code);
            }

            const mainNode = ast.body[0];
            const match = await this.findSimilarPattern(mainNode);
            
            return {
                title: this.generateTitle(mainNode),
                description: this.generateDescription(mainNode, match),
                language: 'javascript', // TODO: Support more languages
                code: code,
                pattern: match ? match.type : undefined,
                similarity: match ? match.score : 0
            };
        } catch (err) {
            return this.createBasicSnippet(code);
        }
    }

    private createBasicSnippet(code: string): SuggestedSnippet {
        const lines = code.split('\n');
        const title = lines[0].trim().slice(0, 60);
        return {
            title: title || 'snippet',
            description: 'Auto-generated snippet',
            language: 'javascript',
            code
        };
    }

    private async findSimilarPattern(node: Node): Promise<PatternMatch | null> {
        const type = node.type;
        const patterns = this.patterns.get(type) || [];
        
        if (patterns.length === 0) {
            return null;
        }

        let bestMatch: PatternMatch = {
            node: patterns[0],
            score: 0.6, // Definindo um score mínimo inicial
            type
        };

        for (const pattern of patterns) {
            const score = this.calculateSimilarity(node, pattern);
            if (score > bestMatch.score) {
                bestMatch = { node: pattern, score, type };
            }
        }

        return bestMatch.score > 0.5 ? bestMatch : null;
    }

    private calculateSimilarity(node1: Node, node2: Node): number {
        // Se os tipos não correspondem, a similaridade é 0
        if (node1.type !== node2.type) {
            return 0;
        }

        let score = 0;
        
        switch (node1.type) {
            case 'FunctionDeclaration': {
                const fn1 = node1 as FunctionDeclaration;
                const fn2 = node2 as FunctionDeclaration;
                
                // Base score for having the same type
                score = 0.3;
                
                // Compare number and names of parameters
                if (fn1.params.length === fn2.params.length) {
                    score += 0.1;
                    
                    // Compare parameter types and names
                    const paramTypeMatches = fn1.params.filter((p1, idx) => {
                        const p2 = fn2.params[idx];
                        return p1.type === p2.type;
                    }).length;
                    
                    score += 0.1 * (paramTypeMatches / fn1.params.length);
                }
                
                // Compare body structure
                if (fn1.body && fn2.body) {
                    // Análise de método
                    const body1 = JSON.stringify(fn1.body);
                    const body2 = JSON.stringify(fn2.body);
                    
                    // Check for similar method calls and patterns
                    const patterns = ['test', 'validate', 'check', 'get', 'set', 'create', 'update', 'delete'];
                    let methodMatchScore = 0;
                    
                    patterns.forEach(pattern => {
                        if (body1.includes(pattern) && body2.includes(pattern)) {
                            methodMatchScore += 0.05;
                        }
                    });
                    
                    score += Math.min(0.2, methodMatchScore); // Cap at 0.2
                    
                    // Compare control flow structure
                    const structurePatterns = ['if', 'for', 'while', 'switch', 'try'];
                    let structureMatchScore = 0;
                    
                    structurePatterns.forEach(pattern => {
                        const pattern1 = (body1.match(new RegExp(pattern, 'g')) || []).length;
                        const pattern2 = (body2.match(new RegExp(pattern, 'g')) || []).length;
                        if (pattern1 === pattern2 && pattern1 > 0) {
                            structureMatchScore += 0.05;
                        }
                    });
                    
                    score += Math.min(0.2, structureMatchScore);
                    
                    // Add small score for similar structure even if content differs
                    const bodyDistance = this.levenshteinDistance(body1, body2);
                    const maxBodyLength = Math.max(body1.length, body2.length);
                    score += 0.1 * (1 - (bodyDistance / maxBodyLength));
                }
                break;
            }
            case 'ClassDeclaration': {
                const class1 = node1 as ClassDeclaration;
                const class2 = node2 as ClassDeclaration;
                
                // Base score for class matching
                score = 0.3;
                
                if (class1.body && class2.body) {
                    const body1 = JSON.stringify(class1.body);
                    const body2 = JSON.stringify(class2.body);
                    
                    // Compare method count
                    const methodCount1 = (body1.match(/"type":"MethodDefinition"/g) || []).length;
                    const methodCount2 = (body2.match(/"type":"MethodDefinition"/g) || []).length;
                    
                    if (methodCount1 === methodCount2) {
                        score += 0.2;
                    } else {
                        score += 0.1 * (1 - Math.abs(methodCount1 - methodCount2) / Math.max(methodCount1, methodCount2));
                    }
                    
                    // Compare constructor presence
                    const hasConstructor1 = body1.includes('"key":{"type":"Identifier","name":"constructor"');
                    const hasConstructor2 = body2.includes('"key":{"type":"Identifier","name":"constructor"');
                    if (hasConstructor1 === hasConstructor2) {
                        score += 0.1;
                    }
                    
                    // Compare property structure
                    const propCount1 = (body1.match(/"type":"PropertyDefinition"/g) || []).length;
                    const propCount2 = (body2.match(/"type":"PropertyDefinition"/g) || []).length;
                    if (propCount1 === propCount2) {
                        score += 0.2;
                    } else {
                        score += 0.1 * (1 - Math.abs(propCount1 - propCount2) / Math.max(propCount1, propCount2));
                    }
                    
                    // Compare inheritance
                    const hasSuper1 = class1.superClass !== null;
                    const hasSuper2 = class2.superClass !== null;
                    if (hasSuper1 === hasSuper2) {
                        score += 0.1;
                    }
                    
                    // Add small score for overall structure similarity
                    const bodyDistance = this.levenshteinDistance(body1, body2);
                    const maxBodyLength = Math.max(body1.length, body2.length);
                    score += 0.1 * (1 - (bodyDistance / maxBodyLength));
                }
                break;
            }
            case 'VariableDeclaration': {
                const var1 = node1 as VariableDeclaration;
                const var2 = node2 as VariableDeclaration;
                
                // Base score for variable declarations
                score = 0.3;
                
                // Compare number of declarations
                if (var1.declarations.length === var2.declarations.length) {
                    score += 0.2;
                }
                
                // Compare declaration kinds (const, let, var)
                if (var1.kind === var2.kind) {
                    score += 0.1;
                }
                
                // Compare initialization patterns
                const decl1 = var1.declarations[0];
                const decl2 = var2.declarations[0];
                
                if (decl1 && decl2) {
                    if ((decl1.init !== null) === (decl2.init !== null)) {
                        score += 0.1;
                    }
                    
                    if (decl1.init && decl2.init && decl1.init.type === decl2.init.type) {
                        score += 0.2;
                    }
                }
                
                // Add structure similarity score
                const str1 = JSON.stringify(var1);
                const str2 = JSON.stringify(var2);
                const distance = this.levenshteinDistance(str1, str2);
                const maxLength = Math.max(str1.length, str2.length);
                score += 0.1 * (1 - (distance / maxLength));
                break;
            }
            default:
                // Para outros tipos, use uma comparação geral
                const str1 = JSON.stringify(node1);
                const str2 = JSON.stringify(node2);
                const distance = this.levenshteinDistance(str1, str2);
                const maxLength = Math.max(str1.length, str2.length);
                score = 1 - (distance / maxLength);
        }
        
        // Clamp score between 0 and 1
        return Math.max(0, Math.min(1, score));
    }

    private generateTitle(node: Node): string {
        switch (node.type) {
            case 'FunctionDeclaration':
                return `Function: ${(node as FunctionDeclaration).id?.name || 'anonymous'}`;
            case 'ClassDeclaration':
                return `Class: ${(node as ClassDeclaration).id?.name || 'anonymous'}`;
            case 'VariableDeclaration':
                const decl = (node as VariableDeclaration).declarations[0];
                return `Variable: ${decl?.id?.type === 'Identifier' ? decl.id.name : 'unnamed'}`;
            default:
                return 'Code Snippet';
        }
    }

    private generateDescription(node: Node, match: PatternMatch | null): string {
        if (!match) {
            return 'Auto-generated snippet';
        }

        const structuralDesc = this.getStructuralDescription(node);
        const similarityDesc = match.score > 0.8 ? 'very similar' : 'similar';
        
        return `${structuralDesc}. This pattern is ${similarityDesc} to other code in your project.`;
    }

    private getStructuralDescription(node: Node): string {
        switch (node.type) {
            case 'FunctionDeclaration':
                const fn = node as FunctionDeclaration;
                return `Função com ${fn.params.length} parâmetro(s)`;
            case 'ClassDeclaration':
                return 'Declaração de classe';
            case 'VariableDeclaration':
                const vd = node as VariableDeclaration;
                return `Declaração de variável com ${vd.declarations.length} variável(eis)`;
            default:
                return 'Trecho de código';
        }
    }

    // Método substituído por uma implementação mais específica acima

    private levenshteinDistance(s1: string, s2: string): number {
        if (s1.length === 0) return s2.length;
        if (s2.length === 0) return s1.length;

        const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

        for (let i = 0; i <= s1.length; i += 1) {
            matrix[0][i] = i;
        }

        for (let j = 0; j <= s2.length; j += 1) {
            matrix[j][0] = j;
        }

        for (let j = 1; j <= s2.length; j += 1) {
            for (let i = 1; i <= s1.length; i += 1) {
                const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }

        return matrix[s2.length][s1.length];
    }
}
