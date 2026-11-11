// Dia de exemplo para os testes: a mesma demanda que o antigo botão "Preencher exemplo" montava (removido do app
// na fase 6, porque o sistema já opera com a demanda real). Sequência pseudoaleatória fixa (semente 7): o mesmo
// estado sempre gera a mesma escala.
import { WIN, NI, GROUND_EQ_TYPE, GROUND_DURATION_H, SIM_EQ_TYPES, MIS } from '../../js/config.js';
import { pad } from '../../js/format.js';
import { blank } from '../../js/rules.js';
import { habilitacoesDoNivel } from '../../js/habilitacoes.js';

export function comExemplo(base) {
  const estado = structuredClone(base);
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(r() * a.length)];
  const wt = [0, 0, 1, 1, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7];
  const poolMis = ['Simulador', 'Voo Local', 'Voo Local', 'Navegação', 'Navegação', 'Voo Solo', 'IFR', 'Multimotor', 'Noturno'];

  // Sem instrutores: 40 fictícios, com as habilitações dos antigos níveis A01–A09 em ciclo
  if (!estado.ins.length) {
    estado.ins = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      nm: `Instrutor ${String(i + 1).padStart(2, '0')}`,
      on: true,
      hab: habilitacoesDoNivel((i % 9) + 1),
      kg: 55 + ((i * 17) % 45),
      aw: WIN.map(() => true)
    }));
  }

  // Sem alunos: 20 com pesos realistas
  if (!estado.stu.length) {
    estado.stu = Array.from({ length: 20 }, (_, i) => ({
      id: estado.nid++,
      nm: pad(i),
      kg: 62 + Math.floor(r() * 28),
      bl: [],
      extra: [],
      ...blank()
    }));
  }

  estado.stu.forEach((d, idx) => {
    d.extra = [];
    // Aluno 01: Ground PA-34 às 06:30, Multimotor PA-34 às 08:20 e Noturno
    if (idx === 0) {
      Object.assign(d, {
        fly: true, mis: 'Ground PA-34', eq: GROUND_EQ_TYPE, p1: 0, p2: 1, nb: GROUND_DURATION_H, ss: 1, pr: 5,
        extra: [
          { mid: estado.nid++, fly: true, mis: 'Multimotor', eq: 'PA-34', p1: 1, p2: 2, nb: 2, ss: 1, pr: 5 },
          { mid: estado.nid++, fly: true, mis: 'Noturno', eq: 'C172', p1: NI, p2: NI, nb: 1, ss: 1, pr: 5 }
        ]
      });
      return;
    }
    // Alunos 02 a 07: turma de Ground C152 no mesmo horário, com o mesmo instrutor
    if (idx >= 1 && idx <= 6) {
      Object.assign(d, {
        fly: true, mis: 'Ground C152', eq: GROUND_EQ_TYPE, p1: 0, p2: 1, nb: GROUND_DURATION_H, ss: 1, pr: 4,
        extra: idx <= 3 ? [
          { mid: estado.nid++, fly: true, mis: 'Voo Local', eq: 'C152', p1: 1, p2: 2, nb: 1, ss: 1, pr: 4 }
        ] : []
      });
      return;
    }
    // Aluno 08: Parafuso no PR-JPL
    if (idx === 7) {
      Object.assign(d, {
        fly: true, mis: 'Parafuso', eq: 'C152', p1: 2, p2: 5, nb: 1, ss: 1, pr: 4, extra: []
      });
      return;
    }
    if (r() > .82) { Object.assign(d, blank()); return; }
    const mis = pick(poolMis);
    const nt = mis === 'Noturno';
    const nb = nt ? 1 + Math.floor(r() * 2) : 1 + Math.floor(r() * r() * 4);
    let eq = MIS[mis].defEq;
    if (mis === 'Simulador') eq = pick(SIM_EQ_TYPES);
    else if (mis === 'IFR') eq = r() > 0.78 ? 'PA-34' : 'C172';
    else if (mis === 'Navegação' || mis === 'Voo Local') eq = r() > 0.72 ? 'C172' : 'C152';

    Object.assign(d, {
      fly: true, mis, eq,
      p1: nt ? NI : pick(wt),
      p2: nt ? NI : pick(wt),
      nb,
      ss: nb >= 3 && r() > .5 ? 2 : 1,
      pr: 1 + Math.floor(r() * 5)
    });
  });
  return estado;
}
