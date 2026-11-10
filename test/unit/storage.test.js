// Camada de dados (ApiClient): estado inicial, migrações de schema, persistência e link compartilhado.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../js/storage.js';
import { DEFAULT_LIM } from '../../js/config.js';
import { rosterSintetico } from '../helpers/estado.js';
import { simularNavegador, navegarPara } from '../helpers/navegador.js';
import { aluno, instrutor, missaoExtra } from '../helpers/montar.js';

beforeEach(() => {
  simularNavegador();
  ApiClient.readOnly = false;
});

describe('Estado inicial', () => {
  it('janelas e frota habilitadas, sem instrutores e sem alunos (o cadastro vem do servidor ou do usuário)', () => {
    const s = ApiClient.createFreshState();
    assert.equal(s.schemaVer, 4);
    assert.deepEqual(s.win, Array(9).fill(true));
    assert.equal(Object.keys(s.av).length, 26);
    assert.ok(Object.values(s.av).every(Boolean));
    assert.deepEqual(s.lim, DEFAULT_LIM);
    assert.equal(s.nid, 1000);
    assert.deepEqual(s.stu, []);
    assert.deepEqual(s.fStatus, {});
    assert.deepEqual(s.ins, []);
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

  it('schema anterior ao v3: mantém os instrutores do navegador (com os mesmos ids) e completa campos ausentes', () => {
    const aw = [true, false, true, false, true, false, true, false, true];
    const antigo = {
      schemaVer: 2,
      win: Array(9).fill(true), av: {}, lim: {}, nid: 1200,
      ins: [{ id: 77, nm: 'Instrutor Antigo', on: false, lv: 6, kg: 99, aw }, instrutor(78, 3), { id: 79, nm: 'Sem dados', lv: 12, aw: [true] }],
      stu: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, nm: `Aluno ${String(i + 1).padStart(2, '0')}`, fly: false, extra: [], ...missaoExtra(0, { fly: false }) }))
    };
    const x = ApiClient.normalizeAndMigrateState(antigo);
    assert.deepEqual(x.ins, [
      { id: 77, nm: 'Instrutor Antigo', on: false, lv: 6, kg: 99, aw },
      instrutor(78, 3),
      { id: 79, nm: 'Sem dados', on: true, lv: 1, kg: 0, aw: Array(9).fill(true) }
    ]);
    assert.deepEqual(x.stu, [], 'remove os 50 alunos de exemplo das versões antigas');
    assert.equal(x.schemaVer, 4);
  });

  it('schema v1: mantém os níveis válidos dos instrutores', () => {
    const x = ApiClient.normalizeAndMigrateState({ schemaVer: 1, ins: [instrutor(9, 9)], stu: [] });
    assert.equal(x.ins[0].lv, 9);
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
    assert.deepEqual((await ApiClient.fetchState()).ins, []);
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
    localStorage.setItem(ApiClient.KEY_LEGACY, JSON.stringify({
      win: [true, true, false, true, true, true, false],
      lim: {},
      ins: [{ id: 1, nm: 'Instrutor 01', on: true, lv: 3, kg: 80, aw: [true, false, true, true, false, true, true] }],
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
    estado.ins = rosterSintetico();
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

describe('Link compartilhável: validação do conteúdo (vem da URL, não é confiável)', () => {
  const ATAQUE = '"><img src=x onerror=alert(1)>';
  const abrir = payload => {
    const share = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    navegarPara(`https://gdruumond.github.io/ACPM/?role=gestor&share=${encodeURIComponent(share)}`);
    const estado = ApiClient.createFreshState();
    return { data: ApiClient.applySharedURLIfPresent(estado), estado };
  };

  it('aceita somente data AAAA-MM-DD, janelas booleanas e matrículas conhecidas', () => {
    const { data, estado } = abrir({ d: `2026-11-11${ATAQUE}`, w: [1, 0, 'x', 1, 1, 1, 1, 1, 1, 1, 1], avOff: ['PR-BTB', ATAQUE] });
    assert.equal(data, null);
    assert.deepEqual(estado.win, [true, false, true, true, true, true, true, true, true]);
    assert.equal(estado.av['PR-BTB'], false);
    assert.equal(ATAQUE in estado.av, false);
  });

  it('status de voo: somente chaves aluno_missão_sessão e valores conhecidos', () => {
    const { estado } = abrir({ st: { '1000_0_1': ATAQUE, '1000_0_2': 'Em Voo', [ATAQUE]: 'Pendente' } });
    assert.deepEqual(estado.fStatus, { '1000_0_2': 'Em Voo' });
  });

  it('instrutores: id inteiro, nível A01–A09, peso numérico e disponibilidade booleana', () => {
    const { estado } = abrir({
      ins: [
        [7, 'Instrutor 07', 1, ATAQUE, ATAQUE, [1, 0]],
        [8, ATAQUE, 0, 12, 500, 'x'],
        [ATAQUE, 'Sem id', 1, 3, 70, []]
      ]
    });
    assert.deepEqual(estado.ins, [
      { id: 7, nm: 'Instrutor 07', on: true, lv: 1, kg: 0, aw: [true, false, false, false, false, false, false, false, false] },
      { id: 8, nm: ATAQUE, on: false, lv: 1, kg: 0, aw: Array(9).fill(true) }
    ]);
  });

  it('alunos e missões: ids inteiros, campos numéricos dentro dos limites da interface', () => {
    const { estado } = abrir({
      fly: [
        [1000, '<b>Ana</b>', ATAQUE, [7, ATAQUE], 1, 'Voo Local', 'C152', ATAQUE, 2, 1e9, 1e9, ATAQUE, [
          [ATAQUE, 'IFR', 'C172', 1, 2, 1, 1, 3],
          [1003, 'IFR', 'C172', 99, -5, 2, 9, 7]
        ]],
        [ATAQUE, 'Sem id', 70, [], 1, 'Voo Local', 'C152', 1, 2, 1, 1, 3, []]
      ]
    });
    assert.equal(estado.stu.length, 1);
    const [ana] = estado.stu;
    assert.deepEqual(
      { id: ana.id, nm: ana.nm, kg: ana.kg, bl: ana.bl, fly: ana.fly, mis: ana.mis, eq: ana.eq, p1: ana.p1, p2: ana.p2, nb: ana.nb, ss: ana.ss, pr: ana.pr },
      { id: 1000, nm: '<b>Ana</b>', kg: 0, bl: [7], fly: true, mis: 'Voo Local', eq: 'C152', p1: -1, p2: 2, nb: 1, ss: 1, pr: 3 }
    );
    assert.deepEqual(ana.extra, [{ mid: 1003, fly: true, mis: 'IFR', eq: 'C172', p1: -1, p2: -1, nb: 2, ss: 1, pr: 3 }]);
  });

  it('limita o tamanho das listas recebidas', () => {
    const linha = id => [id, `Aluno ${id}`, 70, [], 1, 'Voo Local', 'C152', 1, 2, 1, 1, 3, []];
    const { estado } = abrir({ fly: Array.from({ length: 600 }, (_, i) => linha(1000 + i)) });
    assert.equal(estado.stu.length, 500);
  });
});
