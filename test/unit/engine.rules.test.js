// Regras operacionais do motor de alocação, conforme o Manual do Usuário (aba 6 · BI).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine, sumUniqueOperationalHours, consolidateTimelineSlots } from '../../js/engine.js';
import { aluno, apenas, cenario, instrutor, missaoExtra, GROUND_C152 } from '../helpers/montar.js';

const alocar = opts => runAllocationEngine(cenario(opts));
const resumo = o => ({ s: o.s, w: o.w, tag: o.tag });
const SO_PP_LJV = apenas('C152', 'PP-LJV');

describe('Voos: janelas preferidas e encaixe', () => {
  it('voo local no C152 sai na Pref. 1 com o instrutor de menor nível habilitado', () => {
    const { out, al, tot } = alocar({ ins: [instrutor(1, 8), instrutor(2, 3), instrutor(3, 1)], stu: [aluno(1000)] });
    assert.equal(tot, 1);
    assert.deepEqual(al, []);
    assert.equal(out.length, 1);
    assert.deepEqual(
      { w: out[0].w, a: out[0].a, b: out[0].b, r: out[0].r, insId: out[0].insId, tag: out[0].tag, h: out[0].h, ss: out[0].ss, kg: out[0].kg, limKg: out[0].limKg, fKey: out[0].fKey, status: out[0].status },
      { w: 1, a: 500, b: 560, r: 'PP-LJV', insId: 3, tag: 'Pref. 1', h: 1, ss: '1/1', kg: 140, limKg: 170, fKey: '1000_0_1', status: 'Confirmado' }
    );
  });

  it('aeronave ocupada leva à Pref. 2 e depois ao próximo horário livre', () => {
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1), instrutor(3, 1)],
      stu: [aluno(1000), aluno(1001), aluno(1002)],
      semAeronaves: SO_PP_LJV
    });
    assert.deepEqual(out.map(resumo), [
      { s: 'Aluno 1002', w: 0, tag: 'Próximo livre' },
      { s: 'Aluno 1000', w: 1, tag: 'Pref. 1' },
      { s: 'Aluno 1001', w: 2, tag: 'Pref. 2' }
    ]);
  });

  it('maior prioridade escolhe o horário primeiro', () => {
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, { pr: 2 }), aluno(1001, { pr: 5 })],
      semAeronaves: SO_PP_LJV
    });
    assert.deepEqual(out.map(resumo), [
      { s: 'Aluno 1001', w: 1, tag: 'Pref. 1' },
      { s: 'Aluno 1000', w: 2, tag: 'Pref. 2' }
    ]);
  });

  it('voo diurno não termina depois das 17:30', () => {
    const { out } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, { nb: 4, p1: 6, p2: 7 })] });
    assert.deepEqual(out.map(o => [o.w, o.a, o.b, o.tag]), [[0, 390, 630, 'Próximo livre']]);
  });

  it('divide as horas em sessões sequenciais', () => {
    const { out } = alocar({ ins: [instrutor(1, 1), instrutor(2, 1)], stu: [aluno(1000, { nb: 3, ss: 2, p1: 0, p2: 2 })] });
    assert.deepEqual(out.map(o => [o.ss, o.w, o.h, o.tag]), [['1/2', 0, 2, 'Pref. 1'], ['2/2', 2, 1, 'Pref. 2']]);
    assert.deepEqual(out.map(o => o.fKey), ['1000_0_1', '1000_0_2']);
  });

  // Comportamento atual, a confirmar com a operação: o comparador `(a === prev.r) - (b === prev.r)`
  // coloca o avião e o instrutor da sessão anterior do aluno no FIM da fila, então a sessão seguinte
  // troca de avião e de instrutor sempre que houver alternativa.
  it('sessão seguinte troca de avião e de instrutor quando há alternativa', () => {
    const { out } = alocar({ ins: [instrutor(1, 1), instrutor(2, 1)], stu: [aluno(1000, { nb: 3, ss: 2, p1: 0, p2: 2 })] });
    assert.deepEqual(out.map(o => [o.r, o.insId]), [['PP-LJV', 1], ['PR-BTB', 2]]);
  });

  it('respeita a disponibilidade do instrutor', () => {
    const aw = Array(9).fill(true);
    aw[1] = false;
    const { out } = alocar({ ins: [instrutor(1, 1, { aw })], stu: [aluno(1000)] });
    assert.deepEqual(out.map(resumo), [{ s: 'Aluno 1000', w: 2, tag: 'Pref. 2' }]);
  });

  it('não usa janelas de operação desativadas', () => {
    const { out } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000)], janelasOff: [1] });
    assert.deepEqual(out.map(resumo), [{ s: 'Aluno 1000', w: 2, tag: 'Pref. 2' }]);
  });

  it('preserva o status salvo do voo', () => {
    const { out } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000)], fStatus: { '1000_0_1': 'Em Voo' } });
    assert.equal(out[0].status, 'Em Voo');
  });
});

describe('Matriz de instrutores A01–A09', () => {
  const casos = [
    ['Simulador', 'Sim. Mono', 2],
    ['Simulador', 'Sim. Multi', 2],
    ['Voo Local', 'C172', 7],
    ['Voo Local', 'PA-34', 9],
    ['Navegação', 'C152', 4],
    ['Voo Solo', 'C152', 5],
    ['Parafuso', 'C152', 6],
    ['Noturno', 'C172', 7],
    ['IFR', 'C172', 8],
    ['IFR', 'PA-34', 9],
    ['Multimotor', 'PA-34', 9]
  ];

  for (const [mis, eq, lv] of casos) {
    it(`${mis} em ${eq} exige A0${lv}+`, () => {
      const noturno = mis === 'Noturno' ? { p1: 8, p2: 8 } : {};
      const pedido = aluno(1000, { mis, eq, ...noturno });

      const abaixo = alocar({ ins: [instrutor(1, lv - 1)], stu: [pedido] });
      assert.equal(abaixo.out.length, 0);
      assert.deepEqual(abaixo.al, [{
        t: 'err', s: 'Aluno 1000',
        m: `Rejeitado: nenhum instrutor ativo com nível A0${lv} ou superior (exigido para ${mis} em ${eq}).`
      }]);

      const habilitado = alocar({ ins: [instrutor(1, lv - 1), instrutor(2, lv)], stu: [pedido] });
      assert.equal(habilitado.out.length, 1);
      assert.equal(habilitado.out[0].insId, 2);
    });
  }

  it('missão em equipamento não permitido é rejeitada', () => {
    const { out, al } = alocar({ stu: [aluno(1000, { mis: 'IFR', eq: 'C152' })] });
    assert.equal(out.length, 0);
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: a missão “IFR” é realizada apenas em C172 ou PA-34 (selecionado: C152).' }]);
  });

  it('instrutor bloqueado pelo aluno não é escalado', () => {
    const ins = [instrutor(1, 1), instrutor(2, 1)];
    assert.equal(alocar({ ins, stu: [aluno(1000, {}, { bl: [1] })] }).out[0].insId, 2);
    assert.deepEqual(alocar({ ins, stu: [aluno(1000, {}, { bl: [1, 2] })] }).al, [
      { t: 'err', s: 'Aluno 1000', m: 'Rejeitado: os instrutores A01+ livres estão bloqueados por este aluno.' }
    ]);
  });

  it('instrutor inativo não é escalado', () => {
    const { out } = alocar({ ins: [instrutor(1, 1, { on: false }), instrutor(2, 1)], stu: [aluno(1000)] });
    assert.equal(out[0].insId, 2);
  });
});

describe('Peso da tripulação', () => {
  it('aluno + instrutor acima do limite é rejeitado', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 1, { kg: 80 })], stu: [aluno(1000, {}, { kg: 100 })] });
    assert.equal(out.length, 0);
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: peso aluno + instrutor acima do limite de 170 kg do C152.' }]);
  });

  it('escolhe um instrutor mais leve que respeite o limite', () => {
    const { out } = alocar({ ins: [instrutor(1, 1, { kg: 80 }), instrutor(2, 5, { kg: 60 })], stu: [aluno(1000, {}, { kg: 100 })] });
    assert.deepEqual([out[0].insId, out[0].kg, out[0].limKg], [2, 160, 170]);
  });

  it('peso do aluno não informado gera aviso sem bloquear o voo', () => {
    const { out, al } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, {}, { kg: 0 })] });
    assert.equal(out.length, 1);
    assert.equal(out[0].kg, 0);
    assert.deepEqual(al, [{ t: 'warn', s: 'Aluno 1000', m: 'Peso do aluno não informado (0 kg): verificação de limite (170 kg) no C152 não realizada.' }]);
  });
});

describe('PR-JPL (C152 Acrobat)', () => {
  it('Parafuso no C152 usa exclusivamente o PR-JPL', () => {
    const { out } = alocar({ ins: [instrutor(1, 6)], stu: [aluno(1000, { mis: 'Parafuso' })] });
    assert.equal(out[0].r, 'PR-JPL');
  });

  it('outras missões nunca usam o PR-JPL', () => {
    const { out, al } = alocar({ stu: [aluno(1000)], semAeronaves: apenas('C152', 'PR-JPL') });
    assert.equal(out.length, 0);
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: nenhum equipamento C152 compatível disponível (manutenção/indisponível).' }]);
  });

  it('Parafuso no C152 é rejeitado com o PR-JPL em manutenção', () => {
    const { al } = alocar({ stu: [aluno(1000, { mis: 'Parafuso' })], semAeronaves: ['PR-JPL'] });
    assert.deepEqual(al, [{
      t: 'err', s: 'Aluno 1000',
      m: 'Rejeitado: a aeronave acrobática PR-JPL (exclusiva para Parafuso no C152) está indisponível/em manutenção.'
    }]);
  });

  it('Parafuso no C172 usa a frota C172', () => {
    const { out } = alocar({ ins: [instrutor(1, 7)], stu: [aluno(1000, { mis: 'Parafuso', eq: 'C172' })] });
    assert.equal(out[0].r, 'PP-ABP');
  });
});

describe('Noturno', () => {
  it('decola somente na janela das 17:30', () => {
    const { out } = alocar({ ins: [instrutor(1, 7)], stu: [aluno(1000, { mis: 'Noturno', eq: 'C172', p1: 8, p2: 8 })] });
    assert.deepEqual(out.map(o => [o.w, o.a, o.b]), [[8, 1050, 1110]]);
  });

  it('é rejeitado com a janela noturna desativada', () => {
    const { al } = alocar({ ins: [instrutor(1, 7)], stu: [aluno(1000, { mis: 'Noturno', eq: 'C172', p1: 8, p2: 8 })], janelasOff: [8] });
    assert.deepEqual(al, [{
      t: 'err', s: 'Aluno 1000',
      m: 'Rejeitado: não há como encaixar 1 h contínuas a partir da janela noturna (17:30) com as janelas habilitadas.'
    }]);
  });
});

describe('Ground School', () => {
  it('forma turma coletiva com um instrutor e conta 1,5 h uma única vez', () => {
    const { out } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [1000, 1001, 1002].map(id => aluno(id, { ...GROUND_C152, p1: 0, p2: 1 }))
    });
    assert.equal(out.length, 3);
    for (const o of out) {
      assert.deepEqual(
        { classKey: o.classKey, insId: o.insId, a: o.a, b: o.b, r: o.r, h: o.h, eqType: o.eqType, groupSize: o.groupSize, tag: o.tag },
        { classKey: 'GND_Ground C152_0_1', insId: 1, a: 390, b: 480, r: 'SALA-GROUND', h: 1.5, eqType: 'Sala Ground', groupSize: 3, tag: 'Pref. 1 · Turma (3)' }
      );
    }
    assert.equal(sumUniqueOperationalHours(out), 1.5);
  });

  it('é ministrado pelo instrutor de menor nível disponível', () => {
    const { out } = alocar({ ins: [instrutor(1, 9), instrutor(2, 4), instrutor(3, 1)], stu: [aluno(1000, GROUND_C152)] });
    assert.equal(out[0].insId, 3);
  });

  it('precede o voo da mesma temática e é antecipado para liberar a Pref. 1 do voo', () => {
    const { out, al } = alocar({
      ins: [instrutor(1, 1), instrutor(2, 1)],
      stu: [aluno(1000, GROUND_C152, { extra: [missaoExtra(1001)] })]
    });
    assert.deepEqual(al, []);
    assert.deepEqual(out.map(o => [o.mis, o.w, o.a, o.b, o.tag]), [
      ['Ground C152', 0, 390, 480, 'Próximo livre'],
      ['Voo Local', 1, 500, 560, 'Pref. 1']
    ]);
  });

  it('o voo é rejeitado quando o Ground pré-requisito não pode ser alocado', () => {
    const soNoturno = Array(9).fill(false);
    soNoturno[8] = true;
    const { out, al } = alocar({
      ins: [instrutor(1, 1, { aw: soNoturno })],
      stu: [aluno(1000, GROUND_C152, { extra: [missaoExtra(1001)] })]
    });
    assert.equal(out.length, 0);
    assert.deepEqual(al, [
      { t: 'err', s: 'Aluno 1000', m: 'Rejeitado: nenhum instrutor disponível durante todo o período de 01h30.' },
      { t: 'err', s: 'Aluno 1000 (Voo Local)', m: 'Rejeitado: o pré-requisito “Ground C152” agendado para hoje não pôde ser alocado antes deste voo.' }
    ]);
  });

  it('não termina depois das 17:30', () => {
    const { al } = alocar({ ins: [instrutor(1, 1)], stu: [aluno(1000, GROUND_C152)], janelasOff: [0, 1, 2, 3, 4, 5, 6] });
    assert.deepEqual(al, [{ t: 'err', s: 'Aluno 1000', m: 'Rejeitado: nenhuma janela diurna habilitada comporta 01h30 de Ground até 17:30.' }]);
  });
});

describe('Horas operacionais e mapa de ocupação', () => {
  const ground = (s, classKey) => ({ s, classKey, fKey: `${s}_0_1`, isGround: true, mis: 'Ground C152', h: 1.5, status: 'Confirmado' });
  const voo = (s, h, status = 'Confirmado') => ({ s, classKey: `${s}_0_1`, fKey: `${s}_0_1`, isGround: false, mis: 'Voo Local', h, status });

  it('soma horas contando cada turma de Ground uma vez e ignorando cancelados', () => {
    const voos = [ground('A', 'T1'), ground('B', 'T1'), ground('C', 'T2'), voo('D', 2), voo('E', 1, 'Cancelado')];
    assert.equal(sumUniqueOperationalHours(voos), 5);
    assert.equal(sumUniqueOperationalHours(voos, o => (o.s === 'D' ? 'Cancelado' : o.status)), 3);
  });

  it('consolida turmas de Ground em uma única barra com a lista de alunos', () => {
    const barras = consolidateTimelineSlots([ground('A', 'T1'), voo('D', 2), ground('B', 'T1')]);
    assert.deepEqual(barras.map(b => b.students), [['A', 'B'], ['D']]);
    assert.equal(barras[0].items.length, 2);
  });
});
