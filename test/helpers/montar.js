// Construtores de cenários pequenos e legíveis para os testes de regras do motor.
import { estadoSintetico, FROTA_POR_TIPO, JANELAS, dois } from './estado.js';
import { habilitacoesDoNivel } from '../../js/habilitacoes.js';

// instrutor(id, lv): com as habilitações que o nível A01–A09 permitia; extra.hab define outras
export const instrutor = (id, lv, extra = {}) => ({
  id, nm: `Instrutor ${dois(id)}`, on: true, hab: habilitacoesDoNivel(lv), kg: 70, aw: Array(JANELAS).fill(true), ...extra
});

// Pedido padrão: Voo Local no C152, Pref. 1 às 08:20 e Pref. 2 às 10:10, 1 h, prioridade 3
const PEDIDO = { fly: true, mis: 'Voo Local', eq: 'C152', p1: 1, p2: 2, nb: 1, ss: 1, pr: 3 };

export const aluno = (id, pedido = {}, extra = {}) => ({
  id, nm: `Aluno ${id}`, kg: 70, bl: [], extra: [], ...PEDIDO, ...pedido, ...extra
});

export const missaoExtra = (mid, pedido = {}) => ({ mid, ...PEDIDO, ...pedido });

export const GROUND_C152 = { mis: 'Ground C152', eq: 'Sala Ground', nb: 1.5 };

// Somente as aeronaves informadas ficam disponíveis no tipo (as demais entram em manutenção)
export const apenas = (tipo, ...manter) => FROTA_POR_TIPO[tipo].filter(r => !manter.includes(r));

export function cenario({ ins = [instrutor(1, 9)], stu = [], semAeronaves = [], janelasOff = [], fStatus = {} } = {}) {
  const estado = estadoSintetico();
  estado.ins = ins;
  estado.stu = stu;
  estado.fStatus = fStatus;
  semAeronaves.forEach(r => { estado.av[r] = false; });
  janelasOff.forEach(w => { estado.win[w] = false; });
  return estado;
}
