// Propriedades que toda escala gerada deve respeitar, verificadas em centenas de cenários aleatórios.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAllocationEngine } from '../../js/engine.js';
import { EQ, GROUND_REG, ACROBAT_REG, T, NI, DEFAULT_LIM } from '../../js/config.js';
import { isGroundMission, reqInsLevel, doesGroundGateFlight } from '../../js/rules.js';
import { gerarCenario } from '../helpers/cenarios.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => 1001 + i);
const execucoes = SEEDS.map(seed => {
  const estado = gerarCenario(seed);
  return { seed, estado, ...runAllocationEngine(estado) };
});

const sobrepoe = (x, y) => x.a < y.b && y.a < x.b;
const pedidoDe = (estado, o) => {
  const stu = estado.stu.find(s => s.id === o.stuId);
  return { stu, d: o.mid ? stu.extra.find(ex => ex.mid === o.mid) : stu };
};

// Executa a verificação em todos os cenários e informa os seeds que violam a propriedade
function emTodos(verificar) {
  const falhas = [];
  for (const exec of execucoes) {
    try { verificar(exec); } catch (e) { falhas.push(`seed ${exec.seed}: ${e.message}`); }
  }
  assert.deepEqual(falhas.slice(0, 5), [], `${falhas.length} cenário(s) violam a propriedade`);
}

describe('Invariantes do motor de alocação', () => {
  it('toda missão marcada é alocada ou recebe um alerta de rejeição', () => emTodos(({ estado, out, al, tot }) => {
    const marcadas = estado.stu.reduce((n, s) => n + (s.fly ? 1 : 0) + s.extra.filter(ex => ex.fly).length, 0);
    const alocadas = new Set(out.map(o => `${o.stuId}_${o.mid}`)).size;
    assert.equal(tot, marcadas);
    assert.equal(alocadas + al.filter(a => a.t === 'err').length, tot);
  }));

  it('nenhuma aeronave ou simulador é escalado em horários sobrepostos', () => emTodos(({ out }) => {
    const voos = out.filter(o => !o.isGround);
    for (const [i, x] of voos.entries()) {
      for (const y of voos.slice(i + 1)) {
        assert.ok(!(x.r === y.r && sobrepoe(x, y)), `${x.r} em ${x.fKey} e ${y.fKey}`);
      }
    }
  }));

  it('nenhum instrutor atende duas turmas ou voos ao mesmo tempo', () => emTodos(({ out }) => {
    for (const [i, x] of out.entries()) {
      for (const y of out.slice(i + 1)) {
        assert.ok(!(x.insId === y.insId && x.classKey !== y.classKey && sobrepoe(x, y)), `instrutor ${x.insId} em ${x.fKey} e ${y.fKey}`);
      }
    }
  }));

  it('nenhum aluno é escalado em horários sobrepostos', () => emTodos(({ out }) => {
    for (const [i, x] of out.entries()) {
      for (const y of out.slice(i + 1)) {
        assert.ok(!(x.stuId === y.stuId && sobrepoe(x, y)), `aluno ${x.stuId} em ${x.fKey} e ${y.fKey}`);
      }
    }
  }));

  it('instrutor ativo, com nível suficiente, disponível em todo o período e não bloqueado', () => emTodos(({ estado, out }) => {
    for (const o of out) {
      const x = estado.ins.find(i => i.id === o.insId);
      const { stu } = pedidoDe(estado, o);
      assert.ok(x.on, `${o.fKey}: instrutor inativo`);
      assert.ok(x.lv >= reqInsLevel(o.mis, o.eqType), `${o.fKey}: ${o.mis}/${o.eqType} com A0${x.lv}`);
      assert.ok(!stu.bl.includes(x.id), `${o.fKey}: instrutor bloqueado`);
      T.forEach((ini, k) => {
        const fim = k < NI ? T[k + 1] : 1440;
        if (o.a < fim && o.b > ini) assert.ok(x.aw[k], `${o.fKey}: instrutor indisponível na janela ${k}`);
      });
    }
  }));

  it('equipamento compatível, disponível e PR-JPL somente para Parafuso', () => emTodos(({ estado, out }) => {
    for (const o of out) {
      if (o.isGround) {
        assert.equal(o.r, GROUND_REG);
        continue;
      }
      assert.ok(EQ[o.eqType].includes(o.r), `${o.fKey}: ${o.r} não pertence a ${o.eqType}`);
      assert.ok(estado.av[o.r], `${o.fKey}: ${o.r} em manutenção`);
      assert.equal(o.r === ACROBAT_REG, o.mis === 'Parafuso' && o.eqType === 'C152', `${o.fKey}: uso indevido do ${ACROBAT_REG}`);
    }
  }));

  it('peso da tripulação dentro do limite do equipamento', () => emTodos(({ out }) => {
    for (const o of out.filter(v => !v.isGround)) {
      assert.equal(o.limKg, DEFAULT_LIM[o.eqType] || 0);
      if (o.limKg && o.stuKg && o.insKg) assert.ok(o.stuKg + o.insKg <= o.limKg, `${o.fKey}: ${o.stuKg + o.insKg} kg > ${o.limKg} kg`);
    }
  }));

  it('janelas habilitadas, Noturno às 17:30 e demais missões até 17:30', () => emTodos(({ estado, out }) => {
    for (const o of out) {
      assert.ok(estado.win[o.w], `${o.fKey}: janela ${o.w} desativada`);
      assert.equal(o.a, T[o.w]);
      if (o.mis === 'Noturno') assert.equal(o.w, NI, `${o.fKey}: Noturno fora das 17:30`);
      else assert.ok(o.w < NI && o.b <= T[NI], `${o.fKey}: termina às ${o.b}`);
      if (o.isGround) assert.equal(o.b - o.a, 90);
    }
  }));

  it('o voo começa depois do término do Ground da mesma temática', () => emTodos(({ out }) => {
    for (const voo of out.filter(o => !o.isGround)) {
      for (const g of out.filter(o => o.isGround && o.stuId === voo.stuId)) {
        if (doesGroundGateFlight(g.mis, { mis: voo.mis, eq: voo.eqType })) {
          assert.ok(voo.a >= g.b, `${voo.fKey} às ${voo.a} antes do ${g.mis} (${g.b})`);
        }
      }
    }
  }));

  it('sessões somam as horas pedidas, em sequência e numeradas', () => emTodos(({ estado, out }) => {
    const grupos = Map.groupBy(out.filter(o => !o.isGround), o => `${o.stuId}_${o.mid}`);
    for (const sessoes of grupos.values()) {
      const { d } = pedidoDe(estado, sessoes[0]);
      const H = Math.max(1, Math.round(+d.nb || 1));
      const K = Math.min(Math.max(+d.ss || 1, 1), H);
      const ordem = [...sessoes].sort((x, y) => x.a - y.a);
      assert.equal(ordem.length, K);
      assert.equal(ordem.reduce((n, s) => n + s.h, 0), H);
      ordem.forEach((s, j) => {
        assert.equal(s.ss, `${j + 1}/${K}`);
        if (j) assert.ok(s.a >= ordem[j - 1].b);
      });
    }
  }));

  it('saída ordenada por horário, com Ground antes dos voos no mesmo horário', () => emTodos(({ out }) => {
    out.slice(1).forEach((o, i) => {
      const ant = out[i];
      assert.ok(ant.a < o.a || (ant.a === o.a && (ant.isGround || !o.isGround)), `${ant.fKey} antes de ${o.fKey}`);
    });
  }));

  it('a sala de Ground recebe uma turma por vez', () => emTodos(({ out }) => {
    const turmas = [...Map.groupBy(out.filter(o => o.isGround), o => o.classKey).values()].map(m => m[0]);
    for (const [i, x] of turmas.entries()) {
      for (const y of turmas.slice(i + 1)) assert.ok(!sobrepoe(x, y), `${x.classKey} e ${y.classKey} ao mesmo tempo`);
    }
  }));

  it('turmas de Ground reúnem a mesma temática, horário e instrutor', () => emTodos(({ out }) => {
    const turmas = Map.groupBy(out.filter(o => o.isGround), o => o.classKey);
    for (const membros of turmas.values()) {
      assert.equal(new Set(membros.map(m => `${m.mis}|${m.w}|${m.insId}`)).size, 1);
      membros.forEach(m => assert.equal(m.groupSize, membros.length));
      assert.ok(isGroundMission(membros[0].mis));
    }
  }));

  it('é determinístico e não altera o estado recebido', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const estado = gerarCenario(seed);
      const copia = structuredClone(estado);
      const primeira = runAllocationEngine(estado);
      assert.deepEqual(estado, copia, `seed ${seed}: estado alterado`);
      assert.deepEqual(runAllocationEngine(estado), primeira, `seed ${seed}: saída diferente`);
    }
  });
});
