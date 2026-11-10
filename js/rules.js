// Regras das missões: Ground School, nível mínimo do instrutor, precedência Ground → voo
// e normalização de pedidos (inclusive nomes de missão de versões anteriores).
import { MIS, EQ_MIN_LV, NI, GROUND_EQ_TYPE, GROUND_DURATION_H } from './config.js';

// Regra da missão pelo nome, somente entre as missões cadastradas (nomes como "constructor" não contam)
export const missionRule = mis => (Object.hasOwn(MIS, mis) ? MIS[mis] : null);

export const isGroundMission = mis => Boolean(missionRule(mis) && missionRule(mis).isGround);

export function reqInsLevel(mis, eq) {
  const m = missionRule(mis) || MIS['Voo Local'];
  if (m.isGround) return 1; // Sem restrição de nível para Ground School (qualquer instrutor A01+)
  return Math.max(m.lv, (Object.hasOwn(EQ_MIN_LV, eq) && EQ_MIN_LV[eq]) || 1);
}

// Verifica se um voo (d) depende de uma missão de Ground (gMis) agendada para o mesmo aluno no dia
export function doesGroundGateFlight(gMis, flightReq) {
  const gRule = missionRule(gMis);
  if (!gRule || !gRule.isGround || isGroundMission(flightReq.mis)) return false;
  if (gRule.gatesEq && flightReq.eq === gRule.gatesEq) return true;
  if (gRule.gatesMis && flightReq.mis === gRule.gatesMis) return true;
  return false;
}

export const blank = () => ({ fly: false, mis: 'Voo Local', eq: 'C152', p1: 1, p2: 2, nb: 1, ss: 1, pr: 3 });

export function migrateLegacyMissionName(mis) {
  if (missionRule(mis)) return mis;
  const map = {
    'PP Local': 'Voo Local',
    'PP Navegação (>27nm)': 'Navegação',
    'PC Visual': 'Voo Local',
    'Multi': 'Multimotor',
    'INVA': 'Voo Local',
    'TGL': 'Voo Local',
    'Ground de Navegação': 'Ground Navegação'
  };
  return Object.hasOwn(map, mis) ? map[mis] : 'Voo Local';
}

export function normalizeMissionFields(target) {
  target.mis = migrateLegacyMissionName(target.mis);
  const mRule = missionRule(target.mis) || MIS['Voo Local'];
  if (!mRule.eq.includes(target.eq)) target.eq = mRule.defEq;
  if (mRule.isGround) {
    target.eq = GROUND_EQ_TYPE;
    target.nb = GROUND_DURATION_H;
    target.ss = 1;
    if (target.p1 === NI) target.p1 = 0;
    if (target.p2 === NI) target.p2 = 1;
  } else if (+target.nb === GROUND_DURATION_H || !Number.isInteger(+target.nb)) {
    target.nb = 1;
  }
}
