// Backend Supabase: leitura com versão, gravação em série e controle de concorrência otimista.
// Usa um cliente falso com a mesma interface do supabase-js (from/select/eq/maybeSingle e rpc).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { criarBackendSupabase } from '../../js/backends/supabase.js';

const espera = ms => new Promise(r => setTimeout(r, ms));

function clienteFalso(documentos = {}, { atraso = 0 } = {}) {
  const banco = new Map(Object.entries(documentos));
  const rpcs = [];
  let falhasDeRede = 0;
  return {
    banco,
    rpcs,
    falharProximas(n) { falhasDeRede = n; },
    from(tabela) {
      assert.equal(tabela, 'documentos');
      const filtros = {};
      const consulta = {
        select(colunas) { assert.equal(colunas, 'conteudo, versao'); return consulta; },
        eq(coluna, valor) { filtros[coluna] = valor; return consulta; },
        async maybeSingle() {
          const doc = banco.get(filtros.chave);
          return { data: doc ? structuredClone(doc) : null, error: null };
        }
      };
      return consulta;
    },
    async rpc(nome, args) {
      assert.equal(nome, 'salvar_documento');
      rpcs.push(structuredClone(args));
      await espera(atraso);
      if (falhasDeRede > 0) { falhasDeRede--; return { data: null, error: { message: 'Failed to fetch', code: '' } }; }
      const atual = banco.get(args.p_chave);
      const versaoAtual = atual ? atual.versao : 0;
      if (args.p_versao_lida !== versaoAtual) return { data: null, error: { code: 'PT409', message: 'alterado por outra pessoa' } };
      banco.set(args.p_chave, { conteudo: args.p_conteudo, versao: versaoAtual + 1 });
      return { data: versaoAtual + 1, error: null };
    }
  };
}

describe('Backend Supabase', () => {
  it('lê o documento e grava a partir da versão lida', async () => {
    const cliente = clienteFalso({ estado: { conteudo: { a: 1 }, versao: 3 } });
    const backend = criarBackendSupabase(cliente);
    assert.deepEqual(await backend.ler('estado'), { a: 1 });
    assert.equal(await backend.gravar('estado', { a: 2 }), true);
    assert.deepEqual(cliente.rpcs, [{ p_chave: 'estado', p_conteudo: { a: 2 }, p_versao_lida: 3 }]);
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: { a: 2 }, versao: 4 });
  });

  it('documento inexistente é lido como null e a primeira gravação o cria', async () => {
    const cliente = clienteFalso();
    const backend = criarBackendSupabase(cliente);
    assert.equal(await backend.ler('bi'), null);
    assert.equal(await backend.gravar('bi', { d: 1 }), true);
    assert.equal(cliente.rpcs[0].p_versao_lida, 0);
    assert.deepEqual(cliente.banco.get('bi'), { conteudo: { d: 1 }, versao: 1 });
  });

  it('gravações seguidas do mesmo documento saem em série, só com o conteúdo mais recente', async () => {
    const cliente = clienteFalso({}, { atraso: 15 });
    const backend = criarBackendSupabase(cliente);
    await backend.ler('estado');
    const gravacoes = [backend.gravar('estado', 'A'), backend.gravar('estado', 'B'), backend.gravar('estado', 'C')];
    assert.deepEqual(await Promise.all(gravacoes), [true, true, true]);
    assert.deepEqual(cliente.rpcs.map(r => [r.p_conteudo, r.p_versao_lida]), [['A', 0], ['C', 1]]);
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: 'C', versao: 2 });
  });

  it('documentos diferentes são gravados de forma independente', async () => {
    const cliente = clienteFalso({}, { atraso: 10 });
    const backend = criarBackendSupabase(cliente);
    await Promise.all([backend.ler('estado'), backend.ler('escala')]);
    await Promise.all([backend.gravar('estado', 1), backend.gravar('escala', 2)]);
    assert.deepEqual([cliente.banco.get('estado').versao, cliente.banco.get('escala').versao], [1, 1]);
  });

  it('conflito: avisa, não grava mais nada e responde false', async () => {
    const cliente = clienteFalso({ estado: { conteudo: 'meu', versao: 4 } });
    const conflitos = [];
    const backend = criarBackendSupabase(cliente, { aoConflito: doc => conflitos.push(doc) });
    await backend.ler('estado');
    cliente.banco.set('estado', { conteudo: 'do colega', versao: 5 });

    assert.equal(await backend.gravar('estado', 'minha alteração'), false);
    assert.deepEqual(conflitos, ['estado']);
    assert.equal(await backend.gravar('historico', []), false);
    assert.equal(cliente.rpcs.length, 1, 'depois do conflito nada mais é enviado');
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: 'do colega', versao: 5 });
  });

  it('erro de rede: avisa e a próxima alteração tenta de novo', async () => {
    const cliente = clienteFalso();
    const erros = [];
    const backend = criarBackendSupabase(cliente, { aoErro: (erro, doc) => erros.push([doc, erro.message]) });
    await backend.ler('estado');
    cliente.falharProximas(1);
    assert.equal(await backend.gravar('estado', 'A'), false);
    assert.deepEqual(erros, [['estado', 'Failed to fetch']]);
    assert.equal(await backend.gravar('estado', 'B'), true);
    assert.deepEqual(cliente.banco.get('estado'), { conteudo: 'B', versao: 1 });
  });

  it('erro na leitura é repassado para quem chamou', async () => {
    const cliente = clienteFalso();
    cliente.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'sem conexão' } }) }) }) });
    const backend = criarBackendSupabase(cliente);
    await assert.rejects(backend.ler('estado'), /sem conexão/);
  });
});
