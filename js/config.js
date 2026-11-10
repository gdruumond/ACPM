// Configurações e constantes operacionais do CIAC/ACPM: janelas de instrução, frota, missões,
// níveis de instrutor (A01–A09), limites de peso e turnos.

export const WIN = ['06:30','08:20','10:10','11:30','12:40','13:40','14:30','16:20','17:30'];
export const NI = 8, DAY = [0,1,2,3,4,5,6,7], NIGHT_OK = [NI];
export const T = WIN.map(w => w.split(':')[0] * 60 + +w.split(':')[1]);

// Frotas físicas exibidas na Aba 1 (Recursos)
export const EQ = {
  'Sim. Mono': ['SIM-MONO-1','SIM-MONO-2'],
  'Sim. Multi': ['SIM-MULTI-1','SIM-MULTI-2'],
  'C152': 'PP-LJV PR-BTB PR-IGU PR-JPL PR-MLB PR-TBT PR-THI PR-VOB PR-VOC PR-VOI PR-VOP PR-VOW PR-VOZ'.split(' '),
  'C172': 'PP-ABP PP-AJS PR-BUL PR-CPL PR-HAR PR-VOY'.split(' '),
  'PA-34': ['PR-VOM','PT-JOB','PT-KIW']
};

export const GROUND_EQ_TYPE = 'Sala Ground';
export const GROUND_REG = 'SALA-GROUND';
export const GROUND_DURATION_MIN = 90; // 01h30min
export const GROUND_DURATION_H = 1.5;

export const SIM_EQ_TYPES = ['Sim. Mono', 'Sim. Multi'];
export const AIRCRAFT_EQ_TYPES = ['C152', 'C172', 'PA-34'];
export const ALL_EQ_TYPES = [...Object.keys(EQ), GROUND_EQ_TYPE];
export const ACROBAT_REG = 'PR-JPL'; // Exclusivo para missão de Parafuso (com instrutor A06+)

export const EQT = {
  'Sim. Mono': 'Sim. Mono',
  'Sim. Multi': 'Sim. Multi',
  'C152': 'C152',
  'C172': 'C172',
  'PA-34': 'PA-34'
};

// Nível mínimo de instrutor exigido pelo equipamento operado em VOO (A07+ para C172, A09 para PA-34)
export const EQ_MIN_LV = {
  'Sala Ground': 1,
  'C152': 1,
  'Sim. Mono': 2,
  'Sim. Multi': 2,
  'C172': 7,
  'PA-34': 9
};

/**
 * Fases / Missões do CIAC (incluindo Ground School de 01h30 e Missões de Voo/Simulador):
 * - Ground C152, Ground C172, Ground PA-34 e Ground Navegação:
 *     Sem restrição de nível de instrutor (lv: 1 -> qualquer instrutor A01+ pode ministrar,
 *     priorizando sempre o de menor nível disponível). Duração 01h30 em turma coletiva,
 *     precedendo obrigatoriamente o primeiro voo da respectiva temática no mesmo dia.
 * - Simulador: exclusivamente Sim. Mono ou Sim. Multi (A02+)
 * - Missões de voo: realizadas exclusivamente em aeronaves (nunca em simuladores)
 * - IFR: exclusivamente C172 (A08+) ou PA-34 (A09)
 * - Noturno: exclusivamente C172 (A07+)
 * - Multimotor: exclusivamente PA-34 (A09)
 */
export const MIS = {
  'Ground C152':      { lv: 1, defEq: GROUND_EQ_TYPE, eq: [GROUND_EQ_TYPE], isGround: true, gatesEq: 'C152' },
  'Ground C172':      { lv: 1, defEq: GROUND_EQ_TYPE, eq: [GROUND_EQ_TYPE], isGround: true, gatesEq: 'C172' },
  'Ground PA-34':     { lv: 1, defEq: GROUND_EQ_TYPE, eq: [GROUND_EQ_TYPE], isGround: true, gatesEq: 'PA-34' },
  'Ground Navegação': { lv: 1, defEq: GROUND_EQ_TYPE, eq: [GROUND_EQ_TYPE], isGround: true, gatesMis: 'Navegação' },
  'Simulador':        { lv: 2, defEq: 'Sim. Mono',    eq: SIM_EQ_TYPES },
  'Voo Local':        { lv: 1, defEq: 'C152',         eq: AIRCRAFT_EQ_TYPES },
  'Navegação':        { lv: 4, defEq: 'C152',         eq: AIRCRAFT_EQ_TYPES },
  'Voo Solo':         { lv: 5, defEq: 'C152',         eq: AIRCRAFT_EQ_TYPES },
  'Parafuso':         { lv: 6, defEq: 'C152',         eq: AIRCRAFT_EQ_TYPES },
  'IFR':              { lv: 8, defEq: 'C172',         eq: ['C172', 'PA-34'] },
  'Noturno':          { lv: 7, defEq: 'C172',         eq: ['C172'] },
  'Multimotor':       { lv: 9, defEq: 'PA-34',        eq: ['PA-34'] }
};

// Limites máximos de peso implícitos ao equipamento (fixos na regra operacional)
export const DEFAULT_LIM = { 'C152': 170, 'C172': 222, 'PA-34': 250 };

export const PRE = {
  'Dia inteiro': [0,1,2,3,4,5,6,7],
  'Manhã': [0,1,2,3],
  'Tarde': [4,5,6,7],
  'Noturno': [8],
  'Dia + noturno': [0,1,2,3,4,5,6,7,8]
};

export const FLIGHT_STATUSES = ['Confirmado', 'Em Voo', 'Pendente', 'Cancelado'];

export const LV_DESC = {
  1: 'A01 · Local C152 / Grounds',
  2: 'A02 · Simulador',
  3: 'A03 · TGL',
  4: 'A04 · Navegação',
  5: 'A05 · Voo Solo',
  6: 'A06 · Parafuso',
  7: 'A07 · C172 / Noturno',
  8: 'A08 · IFR',
  9: 'A09 · PA-34 Sêneca'
};
export const LV = [1,2,3,4,5,6,7,8,9].map(n => [n, LV_DESC[n]]);
