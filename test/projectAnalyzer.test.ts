import { expect } from 'chai';
import { ProjectAnalyzer } from '../src/projectAnalyzer';

// Nota: testes usam ambiente VS Code; aqui validamos apenas que coleta não explode e retorna estrutura.

describe('ProjectAnalyzer', () => {
  it('collectMetrics retorna estrutura básica', async () => {
    const analyzer = new ProjectAnalyzer();
    const metrics = await analyzer.collectMetrics();
    expect(metrics).to.have.property('totalFiles');
    expect(metrics).to.have.property('totalLines');
    expect(metrics).to.have.property('functions');
    expect(metrics).to.have.property('classes');
  }).timeout(20000);
});
