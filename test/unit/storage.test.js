// Camada de dados (ApiClient): estado inicial, migrações de schema, persistência e link compartilhado.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../js/storage.js';
import { INS_DATA, DEFAULT_LIM } from '../../js/config.js';
import { simularNavegador, navegarPara } from '../helpers/navegador.js';
import { aluno, instrutor, missaoExtra } from '../helpers/montar.js';

beforeEach(() => {
  simularNavegador();
  ApiClient.readOnly = false;
});

describe('Estado inicial', () => {
  it('janelas e frota habilitadas, 40 instrutores A01–A09 em ciclo e nenhum aluno', () => {
    const s = ApiClient.createFreshState();
    assert.equal(s.schemaVer, 4);
    assert.deepEqual(s.win, Array(9).fill(true));
    assert.equal(Object.keys(s.av).length, 26);
    assert.ok(Object.values(s.av).every(Boolean));
    assert.deepEqual(s.lim, DEFAULT_LIM);
    assert.equal(s.nid, 1000);
    assert.deepEqual(s.stu, []);
    assert.deepEqual(s.fStatus, {});
    assert.equal(s.ins.length, INS_DATA.length);
    assert.deepEqual(s.ins.slice(0, 10).map(x => x.lv), [1, 2, 3, 4, 5, 6, 7, 8, 9, 1]);
    assert.deepEqual(s.ins[0], { id: 1, nm: INS_DATA[0][0], on: true, lv: 1, kg: INS_DATA[0][1], aw: Array(9).fill(true) });
  });
});

describe('Migração de estado', () => {
  it('estado inválido vira estado inicial', () => {
    assert.equal(ApiClient.normalizeAndMigrateState(null).schemaVer, 4);
    assert.deepEqual(ApiClient.normalizeAndMigrateState({ stu: 'x', ins: [] }).stu, []);
  });

  it('schema v4: preserva o cadastro e normaliza os pedidos', () => {
    const estado = ApiClient.createFreshState();
    estado.lim = { C152: 999 };
    estado.nid = 5;
    estado.stu = [aluno(1000, { mis: 'PP Local', eq: 'PA-34' }, { extra: [{ ...missaoExtra(undefined, { mis: 'Ground de Navegação', eq: 'C152', p1: 8, p2: 8 }) }] })];
    const x = ApiClient.normalizeAndMigrateState(estado);
    assert.deepEqual(x.lim, DEFAULT_LIM);
    assert.equal(x.nid, 1001);
    assert.deepEqual([x.stu[0].mis, x.stu[0].eq], ['Voo Local', 'PA-34']);
    assert.deepEqual(
      [x.stu[0].extra[0].mid, x.stu[0].extra[0].mis, x.stu[0].extra[0].eq, x.stu[0].extra[0].p1, x.stu[0].extra[0].nb],
      [1000, 'Ground Navegação', 'Sala Ground', 0, 1.5]
    );
  });

  it('schema anterior ao v3: refaz a lista oficial de instrutores mantendo disponibilidade, peso e turnos', () => {
    const [nome] = INS_DATA[3];
    const aw = [true, false, true, false, true, false, true, false, true];
    const antigo = {
      schemaVer: 2,
      win: Array(9).fill(true), av: {}, lim: {}, nid: 1200,
      ins: [{ id: 77, nm: nome.toUpperCase(), on: false, lv: 6, kg: 99, aw }, instrutor(78, 3)],
      stu: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, nm: `Aluno ${String(i + 1).padStart(2, '0')}`, fly: false, extra: [], ...missaoExtra(0, { fly: false }) }))
    };
    const x = ApiClient.normalizeAndMigrateState(antigo);
    assert.equal(x.ins.length, INS_DATA.length);
    assert.deepEqual(x.ins[3], { id: 4, nm: nome, on: false, lv: 6, kg: 99, aw });
    assert.deepEqual(x.ins[0].lv, 1);
    assert.deepEqual(x.stu, [], 'remove os 50 alunos de exemplo das versões antigas');
    assert.equal(x.schemaVer, 4);
  });

  it('schema v1: reatribui os níveis A01–A09 em ciclo', () => {
    const [nome] = INS_DATA[3];
    const x = ApiClient.normalizeAndMigrateState({ schemaVer: 1, ins: [{ id: 9, nm: nome, on: true, lv: 9, kg: 70, aw: Array(9).fill(true) }], stu: [] });
    assert.equal(x.ins[3].lv, 4);
  });
});

describe('Persistência local', () => {
  it('salva e recupera o estado, a escala, o histórico e o BI', async () => {
    const estado = ApiClient.createFreshState();
    estado.stu = [aluno(1000)];
    assert.equal(await ApiClient.saveState(estado), true);
    assert.deepEqual((await ApiClient.fetchState()).stu[0].nm, 'Aluno 1000');

    const res = { out: [{ fKey: '1000_0_1' }], al: [], tot: 1 };
    await ApiClient.saveResult(res);
    assert.deepEqual(await ApiClient.fetchResult(), res);

    await ApiClient.saveAudit([{ id: 1, desc: 'x' }]);
    assert.deepEqual(await ApiClient.fetchAudit(), [{ id: 1, desc: 'x' }]);

    await ApiClient.saveBI({ '2026-11-11': { out: [], tot: 0, rej: 0 } });
    assert.deepEqual(Object.keys(await ApiClient.fetchBI()), ['2026-11-11']);
  });

  it('sem dados salvos: estado inicial, sem escala, histórico e BI vazios', async () => {
    assert.equal((await ApiClient.fetchState()).ins.length, INS_DATA.length);
    assert.equal(await ApiClient.fetchResult(), null);
    assert.deepEqual(await ApiClient.fetchAudit(), []);
    assert.deepEqual(await ApiClient.fetchBI(), {});
  });

  it('dados corrompidos não quebram o carregamento', async () => {
    for (const k of [ApiClient.KEY_STATE, ApiClient.KEY_RESULT, ApiClient.KEY_AUDIT, ApiClient.KEY_BI]) localStorage.setItem(k, '{corrompido');
    assert.equal((await ApiClient.fetchState()).schemaVer, 4);
    assert.equal(await ApiClient.fetchResult(), null);
    assert.deepEqual(await ApiClient.fetchAudit(), []);
    assert.deepEqual(await ApiClient.fetchBI(), {});
  });

  it('migra o formato acpm2 (7 janelas) para as 9 janelas atuais', async () => {
    const [nome] = INS_DATA[0];
    localStorage.setItem(ApiClient.KEY_LEGACY, JSON.stringify({
      win: [true, true, false, true, true, true, false],
      lim: {},
      ins: [{ id: 1, nm: nome, on: true, lv: 3, kg: 80, aw: [true, false, true, true, false, true, true] }],
      stu: [{ id: 5, nm: 'Aluno 5', kg: 70, bl: [], fly: true, mis: 'PP Local', eq: 'C152', p1: 3, p2: -1, nb: 1, ss: 2, pr: 3 }]
    }));
    const x = await ApiClient.fetchState();
    assert.deepEqual(x.win, [true, true, false, false, true, true, true, true, false]);
    assert.deepEqual(x.ins[0].aw, [true, false, true, true, true, true, false, true, true]);
    assert.deepEqual([x.stu[0].p1, x.stu[0].p2, x.stu[0].ss, x.stu[0].mis], [4, -1, 1, 'Voo Local']);
  });

  it('modo somente leitura (link compartilhado) não grava nada', async () => {
    ApiClient.readOnly = true;
    assert.equal(await ApiClient.saveState(ApiClient.createFreshState()), false);
    await ApiClient.saveResult({ out: [], al: [], tot: 0 });
    await ApiClient.saveAudit([{ id: 1 }]);
    await ApiClient.saveBI({ d: {} });
    for (const k of [ApiClient.KEY_STATE, ApiClient.KEY_RESULT, ApiClient.KEY_AUDIT, ApiClient.KEY_BI]) {
      assert.equal(localStorage.getItem(k), null, k);
    }
  });
});

describe('Link compartilhável (perfil Gestor)', () => {
  it('leva data, janelas, manutenção, instrutores, status e somente os alunos que voam', () => {
    const estado = ApiClient.createFreshState();
    estado.win[2] = false;
    estado.av['PR-BTB'] = false;
    estado.ins[0].on = false;
    estado.fStatus = { '1000_0_1': 'Em Voo' };
    estado.stu = [
      aluno(1000, {}, { kg: 81, bl: [3] }),
      aluno(1001, { fly: false }),
      aluno(1002, { fly: false }, { extra: [missaoExtra(1003, { mis: 'IFR', eq: 'C172' }), missaoExtra(1004, { fly: false })] })
    ];

    const link = ApiClient.encodeShareableURL(estado, '2026-11-11');
    assert.match(link, /^https:\/\/gdruumond\.github\.io\/ACPM\/\?role=gestor&share=/);

    navegarPara(link);
    const destino = ApiClient.createFreshState();
    assert.equal(ApiClient.applySharedURLIfPresent(destino), '2026-11-11');
    assert.deepEqual(destino.win, estado.win);
    assert.equal(destino.av['PR-BTB'], false);
    assert.deepEqual(destino.ins, estado.ins);
    assert.deepEqual(destino.fStatus, estado.fStatus);
    assert.deepEqual(destino.stu.map(s => [s.id, s.fly, s.kg, s.bl, s.extra.map(ex => [ex.mid, ex.mis])]), [
      [1000, true, 81, [3], []],
      [1002, false, 70, [], [[1003, 'IFR']]]
    ]);
  });

  it('sem parâmetro share não altera o estado', () => {
    const estado = ApiClient.createFreshState();
    assert.equal(ApiClient.applySharedURLIfPresent(estado), null);
    assert.deepEqual(estado, ApiClient.createFreshState());
  });
});
