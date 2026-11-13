// Painel do dia no estilo dos aeroportos (fase 8): um quadro de Partidas (todas as do dia) e um de Chegadas (as que
// ainda não pousaram ou terminaram), que se alternam página a página, como nos painéis da INFRAERO. Os dois seguem o
// horário efetivo (o atrasado no previsto), mostram o horário programado e, no atraso, o previsto. A turma de Ground é
// uma linha só, sem os nomes dos alunos. Servem à visão "Painel" da Escala e à tela da recepção.
import { GROUND_EQ_TYPE } from './config.js';
import { nomeDoRecurso } from './categorias.js';
import { isGroundMission } from './rules.js';
import { intervaloEfetivo, textoDoDetalhe } from './status.js';

// Uma linha por voo (a turma de Ground, uma só: cancelada só quando todos os alunos estão), no horário efetivo
export function linhasDoQuadro(out, fStatus = {}, fObs = {}) {
  const statusDe = o => fStatus[o.fKey] || o.status || 'Confirmado';
  const grupos = [];
  const turmas = new Map();
  for (const o of out) {
    const chave = (o.isGround || isGroundMission(o.mis)) && o.classKey ? o.classKey : null;
    if (chave && turmas.has(chave)) { turmas.get(chave).push(o); continue; }
    const grupo = [o];
    if (chave) turmas.set(chave, grupo);
    grupos.push(grupo);
  }
  return grupos.map((itens, ordem) => {
    const ativos = itens.filter(o => statusDe(o) !== 'Cancelado');
    const principal = ativos[0] || itens[0];
    const status = statusDe(principal);
    const detalhe = fObs[principal.fKey];
    const { a, b } = intervaloEfetivo(principal, status, detalhe);
    return {
      chave: principal.classKey || principal.fKey,
      ground: Boolean(principal.isGround || isGroundMission(principal.mis)),
      turma: itens.length > 1,
      inicio: a,
      fim: b,
      original: a === principal.a ? null : { inicio: principal.a, fim: principal.b },
      recurso: nomeDoRecurso(principal.r),
      modelo: principal.eqType === GROUND_EQ_TYPE ? '' : principal.eqType || '',
      alunos: itens.map(o => o.s),
      instrutor: principal.ins,
      missao: principal.mis,
      status,
      motivo: status === 'Cancelado' ? textoDoDetalhe(status, detalhe) : '',
      ordem
    };
  }).sort((x, y) => x.inicio - y.inicio || x.ordem - y.ordem).map(({ ordem, ...linha }) => linha);
}

const NO_QUADRO = { 'Em Voo': 'Em voo' };

// A linha como aparece no quadro: o horário programado (da decolagem nas partidas, do pouso nas chegadas), o previsto
// quando atrasado e a observação (o status; o cancelado com o motivo)
function linhaDoAeroporto(l, momento) {
  const efetivo = momento === 'partida' ? l.inicio : l.fim;
  const programado = l.original ? (momento === 'partida' ? l.original.inicio : l.original.fim) : efetivo;
  const n = l.alunos.length;
  return {
    chave: l.chave,
    efetivo,
    horario: programado,
    previsto: l.original ? efetivo : null,
    missao: l.missao,
    modelo: l.ground ? 'Ground' : l.modelo,
    aeronave: l.recurso,
    aluno: l.ground ? `${n} ${n === 1 ? 'aluno' : 'alunos'}` : l.alunos.join(', '),
    instrutor: l.instrutor,
    observacao: [NO_QUADRO[l.status] || l.status, l.motivo].filter(Boolean).join(' · '),
    classe: l.status.replace(/\s+/g, '')
  };
}

const peloEfetivo = (x, y) => x.efetivo - y.efetivo;

// Partidas: todas as do dia
export const quadroDePartidas = linhas => linhas.map(l => linhaDoAeroporto(l, 'partida')).sort(peloEfetivo);

// Chegadas: as pendentes no minuto do quadro (o pouso ainda não passou). O voo em voo continua até mudar de status, e o
// cancelado fica até o horário dele passar
export const quadroDeChegadas = (linhas, agora) => linhas
  .filter(l => l.fim > agora || (l.status === 'Em Voo' && Number.isFinite(agora)))
  .map(l => linhaDoAeroporto(l, 'chegada'))
  .sort(peloEfetivo);

// O minuto do quadro: o de agora no dia de hoje; num dia futuro, antes de tudo; num dia passado, depois de tudo
export const minutoDoQuadro = (data, hoje, minutoAgora) => (data > hoje ? -Infinity : data < hoje ? Infinity : minutoAgora);

export function paginar(lista, porPagina) {
  const paginas = [];
  for (let i = 0; i < lista.length; i += porPagina) paginas.push(lista.slice(i, i + porPagina));
  return paginas.length ? paginas : [[]];
}

// As telas na ordem em que se alternam, como no aeroporto: as páginas de partidas e depois as de chegadas
export function telasDoPainel(partidas, chegadas, porPagina) {
  return [['partidas', partidas], ['chegadas', chegadas]].flatMap(([quadro, lista]) => {
    const paginas = paginar(lista, porPagina);
    return paginas.map((linhas, i) => ({ quadro, pagina: i + 1, paginas: paginas.length, linhas }));
  });
}
