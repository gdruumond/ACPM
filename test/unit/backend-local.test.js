// Backend local (localStorage) e a troca de backend do ApiClient.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { backendLocal } from '../../js/backends/local.js';
import { ApiClient } from '../../js/storage.js';
import { simularNavegador } from '../helpers/navegador.js';

beforeEach(() => simularNavegador());

describe('Backend local (localStorage)', () => {
  it('grava e lê cada documento na sua chave do localStorage', async () => {
    const chaves = { estado: 'acpm3', escala: 'acpm3_res', historico: 'acpm3_audit', bi: 'acpm3_bi' };
    for (const [documento, chaveLocal] of Object.entries(chaves)) {
      assert.equal(await backendLocal.gravar(documento, { documento }), true);
      assert.deepEqual(JSON.parse(localStorage.getItem(chaveLocal)), { documento });
      assert.deepEqual(await backendLocal.ler(documento), { documento });
    }
  });

  it('documento ausente ou corrompido é lido como null', async () => {
    assert.equal(await backendLocal.ler('escala'), null);
    localStorage.setItem('acpm3_bi', '{corrompido');
    assert.equal(await backendLocal.ler('bi'), null);
  });

  it('recusa documentos desconhecidos', async () => {
    await assert.rejects(backendLocal.ler('outro'), /documento desconhecido/);
    await assert.rejects(backendLocal.gravar('outro', {}), /documento desconhecido/);
  });
});

describe('ApiClient com outro backend', () => {
  const original = ApiClient.backend;
  afterEach(() => { ApiClient.backend = original; ApiClient.readOnly = false; });

  it('lê e grava pelo backend configurado e respeita o modo somente leitura', async () => {
    const memoria = new Map();
    ApiClient.backend = { ler: async chave => memoria.get(chave) ?? null, gravar: async (chave, conteudo) => { memoria.set(chave, conteudo); return true; } };

    const estado = ApiClient.createFreshState();
    assert.equal(await ApiClient.saveState(estado), true);
    await ApiClient.saveResult({ out: [], al: [], tot: 0 });
    await ApiClient.saveAudit([{ id: 1 }]);
    await ApiClient.saveBI({ '2026-11-11': { out: [] } });
    assert.deepEqual([...memoria.keys()], ['estado', 'escala', 'historico', 'bi']);
    assert.equal((await ApiClient.fetchState()).ins.length, estado.ins.length);
    assert.deepEqual(await ApiClient.fetchResult(), { out: [], al: [], tot: 0 });
    assert.equal(localStorage.getItem('acpm3'), null, 'nada vai para o localStorage');

    ApiClient.readOnly = true;
    memoria.clear();
    assert.equal(await ApiClient.saveState(estado), false);
    await ApiClient.saveAudit([{ id: 2 }]);
    assert.equal(memoria.size, 0);
  });
});
