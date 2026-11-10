// Habilitações individuais dos instrutores (fase 4). No aeroclube as funções não são cumulativas: há instrutor
// de C172 que não dá simulador e instrutor de PA-34 que não faz parafuso. Cada instrutor tem a lista do que pode
// fazer; uma missão exige a habilitação da missão e, no C172 e no PA-34, também a do avião.

// Ordem da grade na aba Instrutores (curto: rótulo da grade; nome: o nome completo, na dica e nas mensagens)
export const HABILITACOES = [
  { id: 'grounds', nome: 'Grounds (C152, C172 e Navegação)', curto: 'Grounds C152/C172/Nav.' },
  { id: 'ground_pa34', nome: 'Ground (PA-34)', curto: 'Ground PA-34' },
  { id: 'sim_mono', nome: 'Simulador (Mono)', curto: 'Sim. Mono' },
  { id: 'sim_multi', nome: 'Simulador (Multi)', curto: 'Sim. Multi' },
  { id: 'tgl', nome: 'TGL (TMA)', curto: 'TGL (TMA)' },
  { id: 'local', nome: 'Voo Local', curto: 'Local' },
  { id: 'navegacao', nome: 'Voo de Navegação', curto: 'Navegação' },
  { id: 'solo', nome: 'Voo para liberação de Solo', curto: 'Liberação de Solo' },
  { id: 'parafuso', nome: 'Voo de Parafuso (SPIN)', curto: 'Parafuso (SPIN)' },
  { id: 'ifr', nome: 'Voo IFR', curto: 'IFR' },
  { id: 'noturno', nome: 'Voo Noturno', curto: 'Noturno' },
  { id: 'c172', nome: 'C172', curto: 'C172' },
  { id: 'mlte', nome: 'MLTE (PA-34)', curto: 'MLTE (PA-34)' },
  { id: 'checador_vfr', nome: 'Checador PP, PC, MNTE, INVA (VFR)', curto: 'Checador VFR' },
  { id: 'checador_ifr', nome: 'Checador PP, PC, MNTE, INVA, IFR', curto: 'Checador IFR' },
  { id: 'checador_mlte', nome: 'Checador PP, PC, MLTE, MNTE, INVA, IFR', curto: 'Checador MLTE IFR' }
];
const ORDEM = new Map(HABILITACOES.map((h, i) => [h.id, i]));
const NOME = new Map(HABILITACOES.map(h => [h.id, h.nome]));
export const nomeDaHabilitacao = id => NOME.get(id) || id;

// Lista válida: só habilitações conhecidas, sem repetição, na ordem da grade
export const normalizarHabilitacoes = lista =>
  (Array.isArray(lista) ? [...new Set(lista.filter(h => ORDEM.has(h)))] : []).sort((a, b) => ORDEM.get(a) - ORDEM.get(b));

// Habilitação de cada missão (o simulador depende do equipamento) e a exigida pelo avião
const DA_MISSAO = {
  'Ground C152': 'grounds',
  'Ground C172': 'grounds',
  'Ground Navegação': 'grounds',
  'Ground PA-34': 'ground_pa34',
  'Voo Local': 'local',
  'TGL (TMA)': 'tgl',
  'Navegação': 'navegacao',
  'Voo Solo': 'solo',
  'Parafuso': 'parafuso',
  'IFR': 'ifr',
  'Noturno': 'noturno',
  'Multimotor': 'mlte'
};
const DO_SIMULADOR = { 'Sim. Mono': 'sim_mono', 'Sim. Multi': 'sim_multi' };

// Voos de cheque: basta um dos checadores credenciados para o cheque, em qualquer avião permitido
const CHEQUES = {
  'Cheque PP': ['checador_vfr', 'checador_ifr', 'checador_mlte'],
  'Cheque PC MNTE VFR': ['checador_vfr', 'checador_ifr', 'checador_mlte'],
  'Cheque PC MNTE IFR': ['checador_ifr', 'checador_mlte'],
  'Cheque PC MLTE VFR': ['checador_mlte'],
  'Cheque PC MLTE IFR': ['checador_mlte']
};
export const ehCheque = mis => Object.hasOwn(CHEQUES, mis);
const DO_AVIAO = { 'C172': 'c172', 'PA-34': 'mlte' };

// Só as chaves do próprio mapa (nomes como "constructor" ou "toString" não contam)
const doMapa = (mapa, chave, padrao) => (Object.hasOwn(mapa, chave) ? mapa[chave] : padrao);

// Exigências da missão no equipamento: todos os grupos, e em cada grupo basta uma das habilitações
export function exigencias(mis, eq) {
  if (ehCheque(mis)) return [[...CHEQUES[mis]]];
  const grupos = [[mis === 'Simulador' ? doMapa(DO_SIMULADOR, eq, 'sim_mono') : doMapa(DA_MISSAO, mis, 'local')]];
  if (Object.hasOwn(DO_AVIAO, eq) && !grupos.some(g => g.includes(DO_AVIAO[eq]))) grupos.push([DO_AVIAO[eq]]);
  return grupos;
}

export const podeFazer = (instrutor, mis, eq) => {
  const hab = Array.isArray(instrutor.hab) ? instrutor.hab : [];
  return exigencias(mis, eq).every(grupo => grupo.some(h => hab.includes(h)));
};

export const descreverExigencias = (mis, eq) => exigencias(mis, eq).map(g => g.map(h => NOME.get(h)).join(' ou ')).join(' + ');

// Migração dos níveis cumulativos A01–A09: o instrutor recebe exatamente o que o nível permitia
// (checadores não existiam: começam desmarcados)
const POR_NIVEL = [
  [1, ['grounds', 'ground_pa34', 'local']],
  [2, ['sim_mono', 'sim_multi']],
  [3, ['tgl']],
  [4, ['navegacao']],
  [5, ['solo']],
  [6, ['parafuso']],
  [7, ['noturno', 'c172']],
  [8, ['ifr']],
  [9, ['mlte']]
];
export const habilitacoesDoNivel = lv => {
  const nivel = Number.isInteger(lv) && lv >= 1 && lv <= 9 ? lv : 1;
  return normalizarHabilitacoes(POR_NIVEL.filter(([n]) => nivel >= n).flatMap(([, h]) => h));
};
