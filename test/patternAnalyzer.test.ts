import { expect } from 'chai';
import * as sinon from 'sinon';
import { ExtensionContext, Uri, ExtensionMode } from 'vscode';
import { PatternAnalyzer } from '../src/patternAnalyzer';
import { Program } from 'estree';
import * as esprima from 'esprima';

// Mock vscode namespace since it's not available in test environment
const vscode = {
    ExtensionMode,
    Uri: {
        file: (path: string) => Uri.file(path)
    }
};

describe('PatternAnalyzer', () => {
    let analyzer: PatternAnalyzer;
    let mockContext: Partial<ExtensionContext>;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: async () => {},
                keys: () => []
            },
            globalState: {
                get: () => undefined,
                update: async () => {},
                keys: () => [],
                setKeysForSync: (keys: readonly string[]) => {}
            },
            extensionPath: '',
            asAbsolutePath: (relativePath: string) => relativePath,
            storagePath: '',
            logPath: '',
            extensionUri: vscode.Uri.file(''),
            extensionMode: vscode.ExtensionMode.Test,
            globalStorageUri: vscode.Uri.file(''),
            logUri: vscode.Uri.file(''),
            storageUri: vscode.Uri.file(''),
            globalStoragePath: ''
        };
        
        analyzer = new PatternAnalyzer(mockContext as ExtensionContext);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('suggestSnippetFromCode', () => {
        it('should suggest snippet from function declaration', async () => {
            const code = `
                function validateEmail(email) {
                    const regex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$/;
                    return regex.test(email);
                }
            `;

            const snippet = await analyzer.suggestSnippetFromCode(code);
            
            expect(snippet).to.have.property('title').that.is.a('string');
            expect(snippet).to.have.property('language', 'javascript');
            expect(snippet.title).to.include('Function');
            expect(snippet.title).to.include('validateEmail');
            expect(snippet.code).to.equal(code);
        });

        it('should suggest snippet from class declaration', async () => {
            const code = `
                class User {
                    constructor(name) {
                        this.name = name;
                    }
                }
            `;

            const snippet = await analyzer.suggestSnippetFromCode(code);
            
            expect(snippet).to.have.property('title').that.is.a('string');
            expect(snippet).to.have.property('language', 'javascript');
            expect(snippet.title).to.include('Class');
            expect(snippet.title).to.include('User');
            expect(snippet.code).to.equal(code);
        });

        it('should suggest snippet from variable declaration', async () => {
            const code = `
                const config = {
                    apiKey: 'abc123',
                    endpoint: 'https://api.example.com'
                };
            `;

            const snippet = await analyzer.suggestSnippetFromCode(code);
            
            expect(snippet).to.have.property('title').that.is.a('string');
            expect(snippet).to.have.property('language', 'javascript');
            expect(snippet.code).to.equal(code);
        });

        it('should handle malformed code gracefully', async () => {
            const code = 'function test( { // malformed';
            
            const snippet = await analyzer.suggestSnippetFromCode(code);
            
            expect(snippet).to.have.property('title').that.is.a('string');
            expect(snippet).to.have.property('code', code);
            expect(snippet).to.have.property('language', 'javascript');
        });

        it('should detect similarity between patterns', async () => {
            const code1 = `
                function validateEmail(email) {
                    const regex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$/;
                    return regex.test(email);
                }
            `;

            const code2 = `
                function validatePhone(phone) {
                    const regex = /^\\d{10,11}$/;
                    return regex.test(phone);
                }
            `;

            // Extract patterns first to simular a real workspace
            const ast1 = esprima.parseScript(code1);
            analyzer.extractPatterns(ast1);

            const ast2 = esprima.parseScript(code2);
            analyzer.extractPatterns(ast2);
            
            // Now test the similarity
            const snippet2 = await analyzer.suggestSnippetFromCode(code2);
            
            expect(snippet2).to.have.property('similarity').that.is.greaterThan(0.5);
        });
    });

    describe('analyzeDocument', () => {
        it('should analyze JavaScript document', async () => {
            const code = `
                function test1() { return 1; }
                function test2() { return 2; }
            `;

            const mockDocument = {
                getText: () => code,
                languageId: 'javascript'
            };

            const ast = await analyzer.analyzeDocument(mockDocument as any);
            expect(ast).to.exist;
            expect(ast).to.have.property('type', 'Program');
            expect((ast as Program).body).to.have.lengthOf(2);
        });

        it('should return null for unsupported languages', async () => {
            const mockDocument = {
                getText: () => 'print("Hello")',
                languageId: 'python'
            };

            const ast = await analyzer.analyzeDocument(mockDocument as any);
            expect(ast).to.be.null;
        });

        it('should handle parse errors gracefully', async () => {
            const mockDocument = {
                getText: () => '{ invalid: javascript ]',
                languageId: 'javascript'
            };

            const ast = await analyzer.analyzeDocument(mockDocument as any);
            expect(ast).to.be.null;
        });
    });
});
