import { expect } from 'chai';
import * as sinon from 'sinon';
import { ExtensionContext } from 'vscode';
import { SnippetStorage } from '../src/snippetStorage';
import { SuggestedSnippet } from '../src/patternAnalyzer';

// Configuração necessária para os testes

describe('SnippetStorage', () => {
    let storage: SnippetStorage;
    let mockContext: Partial<ExtensionContext>;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        const mockState = new Map<string, any>();
        mockContext = {
            workspaceState: {
                get: (key: string) => mockState.get(key),
                update: async (key: string, value: any) => { mockState.set(key, value); },
                keys: () => Array.from(mockState.keys())
            },
            globalState: {
                get: (key: string) => mockState.get(key),
                update: async (key: string, value: any) => { mockState.set(key, value); },
                keys: () => Array.from(mockState.keys()),
                setKeysForSync: (keys: readonly string[]) => {}
            }
        };
        
        storage = new SnippetStorage(mockContext as ExtensionContext);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('saveSnippet', () => {
        it('should save a snippet', async () => {
            const snippet: SuggestedSnippet = {
                title: 'Test Snippet',
                description: 'A test snippet',
                language: 'javascript',
                code: 'console.log("test");'
            };

            await storage.saveSnippet(snippet);
            const snippets = await storage.listSnippets();
            expect(snippets).to.have.lengthOf(1);
            expect(snippets[0]).to.deep.equal(snippet);
        });

        it('should store duplicate snippets with same code', async () => {
            const snippet1: SuggestedSnippet = {
                code: 'console.log("test");',
                language: 'javascript'
            };

            const snippet2: SuggestedSnippet = {
                code: 'console.log("test");',
                language: 'javascript',
                title: 'Different Title'
            };

            await storage.saveSnippet(snippet1);
            await storage.saveSnippet(snippet2);

            const snippets = await storage.listSnippets();
            expect(snippets).to.have.lengthOf(2);
        });
    });

    describe('listSnippets', () => {
        it('should return empty array when no snippets exist', async () => {
            const snippets = await storage.listSnippets();
            expect(snippets).to.be.an('array').that.is.empty;
        });

        it('should return all saved snippets', async () => {
            const snippet1: SuggestedSnippet = {
                title: 'First Snippet',
                code: 'console.log("first");',
                language: 'javascript'
            };

            const snippet2: SuggestedSnippet = {
                title: 'Second Snippet',
                code: 'console.log("second");',
                language: 'javascript'
            };

            await storage.saveSnippet(snippet1);
            await storage.saveSnippet(snippet2);

            const snippets = await storage.listSnippets();
            expect(snippets).to.have.lengthOf(2);
            expect(snippets[0].code).to.equal(snippet1.code);
            expect(snippets[1].code).to.equal(snippet2.code);
        });

        it('should store snippets of different languages', async () => {
            const jsSnippet: SuggestedSnippet = {
                code: 'console.log("test");',
                language: 'javascript'
            };

            const pySnippet: SuggestedSnippet = {
                code: 'print("test")',
                language: 'python'
            };

            await storage.saveSnippet(jsSnippet);
            await storage.saveSnippet(pySnippet);

            const snippets = await storage.listSnippets();
            expect(snippets).to.have.lengthOf(2);
            expect(snippets[0].language).to.equal('javascript');
            expect(snippets[1].language).to.equal('python');
        });
    });

    describe('deleteSnippet', () => {
        it('should delete an existing snippet', async () => {
            const snippet: SuggestedSnippet = {
                title: 'Test Snippet',
                description: 'A test snippet',
                language: 'javascript',
                code: 'console.log("test");'
            };

            await storage.saveSnippet(snippet);
            const result = await storage.deleteSnippet(snippet);
            const snippets = await storage.listSnippets();

            expect(result).to.be.true;
            expect(snippets).to.have.lengthOf(0);
        });

        it('should return false when trying to delete non-existent snippet', async () => {
            const snippet: SuggestedSnippet = {
                title: 'Non-existent',
                description: 'Does not exist',
                language: 'javascript',
                code: 'console.log("test");'
            };

            const result = await storage.deleteSnippet(snippet);
            expect(result).to.be.false;
        });

        it('should delete correct snippet when multiple exist', async () => {
            const snippet1: SuggestedSnippet = {
                title: 'First Snippet',
                code: 'console.log("first");',
                language: 'javascript'
            };

            const snippet2: SuggestedSnippet = {
                title: 'Second Snippet',
                code: 'console.log("second");',
                language: 'javascript'
            };

            await storage.saveSnippet(snippet1);
            await storage.saveSnippet(snippet2);

            const result = await storage.deleteSnippet(snippet1);
            const snippets = await storage.listSnippets();

            expect(result).to.be.true;
            expect(snippets).to.have.lengthOf(1);
            expect(snippets[0].code).to.equal(snippet2.code);
        });

        it('should handle partial matches correctly', async () => {
            const snippet1: SuggestedSnippet = {
                title: 'Original',
                code: 'console.log("test");',
                language: 'javascript'
            };

            const partialMatch: SuggestedSnippet = {
                code: 'console.log("test");',
                language: 'javascript'
            };

            await storage.saveSnippet(snippet1);
            const result = await storage.deleteSnippet(partialMatch);
            const snippets = await storage.listSnippets();

            expect(result).to.be.false;
            expect(snippets).to.have.lengthOf(1);
        });
    });
});