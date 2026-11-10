// ApiClient com escala por data: carregar e salvar uma data, cópia do dia anterior, BI e migração dos
// documentos da fase 2 (no próprio backend ou vindos de outro, como no envio dos dados do navegador).
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../js/storage.js';
import { backendLocal } from '../../js/backends/local.js';
import { simularNavegador } from '../helpers/navegador.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno, missaoExtra } from '../helpers/montar.js';

// Backend em memória com a mesma interface, contando as gravações
function backendEmMemoria() {
  const docs = new Map();
  const historico = [];
  const gravacoes = [];
  return {
    docs, historico, gravacoes,
    async ler(doc) { return docs.has(doc) ? structuredClone(docs.get(doc)) : null; },
    async gravar(doc, conteudo) { gravacoes.push(doc); docs.set(doc, structuredClone(conteudo)); return true; },
    async listarDias(de, ate) {
      return [...docs.keys()].filter(k => k.startsWith('dia:')).map(k => k.slice(4)).filter(d => d >= de && d <= ate).sort()
        .map(d => ({ data: d, conteudo: structuredClone(docs.get(`dia:${d}`)) }));
    },
    async diaAnterior(data) {
      const d = [...docs.keys()].filter(k => k.startsWith('dia:')).map(k => k.slice(4)).filter(x => x < data).sort().pop();
      return d ? { data: d, conteudo: structuredClone(docs.get(`dia:${d}`)) } : null;
    },
    async registrar(entrada) { historico.push({ id: historico.length + 1, ...entrada }); return historico.length; },
    async listarHistorico(data) { return historico.filter(e => e.data === data).reverse(); },
    async importarHistorico(data, entradas) {
      if (historico.some(e => e.importado)) return 0;
      entradas.forEach(e => historico.push({ id: historico.length + 1, data, importado: true, ...e }));
      return entradas.length;
    }
  };
}

const original = ApiClient.backend;
let backend;
beforeEach(() => {
  simularNavegador();
  backend = backendEmMemoria();
  ApiClient.backend = backend;
  ApiClient.readOnly = false;
  ApiClient.cadastroGravado = undefined;
});
afterEach(() => { ApiClient.backend = original; ApiClient.readOnly = false; });

const escalaDe = data => ({ out: [{ fKey: '1000_0_1', h: 1 }], al: [], tot: 1, data });

describe('Carregar e salvar uma data', () => {
  it('sem cadastro nem dias: estado vazio para a data, sem escala', async () => {
    const { estado, escala, novo } = await ApiClient.carregarDia('2026-11-11');
    assert.deepEqual([estado.ins, estado.stu, escala, novo], [[], [], null, true]);
    assert.equal(estado.schemaVer, 4);
  });

  it('salva e carrega de volta o mesmo estado e a mesma escala', async () => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000, {}, { extra: [missaoExtra(1001)] })] });
    estado.av['PR-BTB'] = false;
    estado.fStatus = { '1000_0_1': 'Em Voo' };
    assert.equal(await ApiClient.salvarDia('2026-11-11', estado, escalaDe('2026-11-11')), true);
    const lido = await ApiClient.carregarDia('2026-11-11');
    assert.deepEqual(lido.estado, estado);
    assert.deepEqual(lido.escala, escalaDe('2026-11-11'));
    assert.equal(lido.novo, false);
  });

  it('grava o cadastro só quando ele muda; o dia é gravado sempre', async () => {
    const estado = ApiClient.normalizeAndMigrateState(estadoSintetico());
    await ApiClient.carregarDia('2026-11-11');
    await ApiClient.salvarDia('2026-11-11', estado, null);
    estado.av['PR-BTB'] = false;
    await ApiClient.salvarDia('2026-11-11', estado, null);
    estado.ins[0].nm = 'Novo nome';
    await ApiClient.salvarDia('2026-11-11', estado, null);
    assert.deepEqual(backend.gravacoes, ['cadastro', 'dia:2026-11-11', 'dia:2026-11-11', 'cadastro', 'dia:2026-11-11']);
  });

  it('data nova começa com uma cópia do dia anterior (sem status e sem escala) e não grava nada', async () => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000)] });
    estado.av['PR-BTB'] = false;
    estado.fStatus = { '1000_0_1': 'Cancelado' };
    await ApiClient.salvarDia('2026-11-11', estado, escalaDe('2026-11-11'));
    backend.gravacoes.length = 0;

    const { estado: novo, escala, novo: ehNovo } = await ApiClient.carregarDia('2026-11-14');
    assert.equal(ehNovo, true);
    assert.equal(escala, null);
    assert.equal(novo.av['PR-BTB'], false);
    assert.deepEqual(novo.stu, estado.stu);
    assert.deepEqual(novo.fStatus, {});
    assert.deepEqual(backend.gravacoes, []);
  });

  it('somente leitura: nada é gravado', async () => {
    ApiClient.readOnly = true;
    assert.equal(await ApiClient.salvarDia('2026-11-11', ApiClient.normalizeAndMigrateState(estadoSintetico()), null), false);
    assert.equal(await ApiClient.registrarHistorico('2026-11-11', { tipo: 'mod', descricao: 'x' }), null);
    assert.deepEqual(backend.gravacoes, []);
    assert.deepEqual(backend.historico, []);
  });
});

describe('Histórico e BI por data', () => {
  it('registra e lista o histórico da data', async () => {
    await ApiClient.registrarHistorico('2026-11-11', { tipo: 'exc', descricao: 'PR-BTB: Manutenção', reverter: { kind: 'setAv' } });
    await ApiClient.registrarHistorico('2026-11-12', { tipo: 'mod', descricao: 'Outra data' });
    assert.deepEqual((await ApiClient.historicoDoDia('2026-11-11')).map(e => e.descricao), ['PR-BTB: Manutenção']);
  });

  it('o BI sai das escalas guardadas no período', async () => {
    const estado = ApiClient.normalizeAndMigrateState(estadoSintetico());
    await ApiClient.salvarDia('2026-11-10', estado, escalaDe('2026-11-10'));
    await ApiClient.salvarDia('2026-11-11', estado, null);
    await ApiClient.salvarDia('2026-12-01', estado, escalaDe('2026-12-01'));
    assert.deepEqual(await ApiClient.biDoPeriodo('2026-11-01', '2026-11-30'), { '2026-11-10': { out: escalaDe().out, tot: 1, rej: 0 } });
  });
});

describe('Migração dos documentos da fase 2', () => {
  async function gravarFase2(destino, { comData = false } = {}) {
    const estado = { ...estadoSintetico(), stu: [aluno(1000)] };
    const escala = { out: [{ fKey: '1000_0_1', h: 1 }], al: [], tot: 1, ...(comData ? { data: '2026-11-20' } : {}) };
    await destino.gravar('estado', estado);
    await destino.gravar('escala', escala);
    await destino.gravar('historico', [{ id: Date.UTC(2026, 10, 9, 13), ts: '10:00:00', type: 'exc', desc: 'PR-BTB: Manutenção', revert: null }]);
    await destino.gravar('bi', { '2026-11-09': { out: [{ fKey: 'x', h: 2 }], tot: 1, rej: 0 }, '2026-11-10': { out: escala.out, tot: 1, rej: 0 } });
    return estado;
  }

  it('converte uma vez: escala na sua data, dias do BI, histórico importado e cadastro por último', async () => {
    const estado = await gravarFase2(backend);
    backend.gravacoes.length = 0;
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), '2026-11-10');
    assert.equal(backend.gravacoes.at(-1), 'cadastro', 'o cadastro é gravado por último (marca a migração como concluída)');
    assert.deepEqual([...backend.docs.keys()].filter(k => k.startsWith('dia:')).sort(), ['dia:2026-11-09', 'dia:2026-11-10']);
    const { estado: lido, escala } = await ApiClient.carregarDia('2026-11-10');
    assert.deepEqual(lido.stu, ApiClient.normalizeAndMigrateState(structuredClone(estado)).stu);
    assert.deepEqual(escala.out, [{ fKey: '1000_0_1', h: 1 }]);
    assert.deepEqual(backend.historico.map(e => [e.data, e.descricao, e.importado]), [['2026-11-10', 'PR-BTB: Manutenção', true]]);
    assert.ok(backend.docs.has('estado'), 'os documentos da fase 2 ficam como cópia');

    backend.gravacoes.length = 0;
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), null, 'não migra de novo');
    assert.deepEqual(backend.gravacoes, []);
  });

  it('sem documentos da fase 2 não faz nada', async () => {
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), null);
    assert.deepEqual(backend.gravacoes, []);
  });

  it('pode migrar os documentos de outro backend (envio dos dados do navegador para o servidor)', async () => {
    await gravarFase2(backendLocal, { comData: true });
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11', backendLocal), '2026-11-20');
    assert.ok(backend.docs.has('cadastro'));
    assert.ok(backend.docs.has('dia:2026-11-20'));
    assert.equal(backend.docs.has('estado'), false, 'o servidor recebe só o formato novo');
  });

  it('se uma gravação falha no meio, a conversão para com erro sem gravar o cadastro; a próxima abertura termina', async () => {
    await gravarFase2(backend);
    const gravar = backend.gravar;
    backend.gravar = async (doc, conteudo) => (doc === 'dia:2026-11-09' ? false : gravar(doc, conteudo));
    await assert.rejects(ApiClient.migrarDocumentosAntigos('2026-11-11'), /conversão dos dados não terminou/);
    assert.equal(backend.docs.has('cadastro'), false, 'sem o cadastro, a conversão continua pendente');
    backend.gravar = async (doc, conteudo) => (doc === 'cadastro' ? false : gravar(doc, conteudo));
    await assert.rejects(ApiClient.migrarDocumentosAntigos('2026-11-11'), /conversão dos dados não terminou/);
    backend.gravar = gravar;
    assert.equal(await ApiClient.migrarDocumentosAntigos('2026-11-11'), '2026-11-10');
    assert.ok(backend.docs.has('cadastro'));
  });

  it('não sobrescreve dias que já existem no destino', async () => {
    await gravarFase2(backend);
    await backend.gravar('dia:2026-11-09', { meu: true });
    await ApiClient.migrarDocumentosAntigos('2026-11-11');
    assert.deepEqual(backend.docs.get('dia:2026-11-09'), { meu: true });
  });
});
