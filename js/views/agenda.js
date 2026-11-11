// Agenda de Solicitações: a agenda de papel da secretaria, digitalizada. Calendário do mês com os pedidos de cada dia,
// a lista do dia escolhido (com a situação de cada pedido na demanda) e o registro de pedidos, com o prazo das 13:00
// do dia anterior.
import { MIS, WIN } from '../config.js';
import { S, DATA, isGestor } from '../state.js';
import { ApiClient } from '../storage.js';
import { $ } from '../dom.js';
import { esc, opts } from '../format.js';
import { registraNaAgenda, operaEscala } from '../perfis.js';
import { JANELAS_DA_AGENDA, FUSO_DO_AEROCLUBE, prazoDaAgendaPermite, primeiraDataAberta, hojeEmSaoPaulo, horaEmSaoPaulo, somarDias } from '../agenda.js';

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const CHAVE_REGISTRADO_POR = 'acpm_agenda_registrado_por';

let diaEscolhido = null;
let mesVisivel = null;
let pedidos = [];

// Quem pode registrar e cancelar: no modo local, quem não está no perfil Gestor; no compartilhado, operadores,
// administradores e a secretaria. A exceção da coordenação é de quem opera a escala (o servidor confere de novo)
export const podeEditarAgenda = () => (ApiClient.perfil ? registraNaAgenda(ApiClient.perfil) : !isGestor());
export const podeUsarExcecao = () => (ApiClient.perfil ? operaEscala(ApiClient.perfil) : !isGestor());
// Importar para a demanda também é de quem opera a escala
const podeImportar = podeUsarExcecao;
export const diaDaAgenda = () => diaEscolhido;

const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dataPorExtenso = iso => {
  const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
  return `${semana}, ${ddmm(iso)}/${iso.slice(0, 4)}`;
};
const quando = instante => new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_DO_AEROCLUBE, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).format(new Date(instante)).replace(',', '');
const disponibilidade = p => (p.janela === 'horario' ? `às ${p.horario}` : (JANELAS_DA_AGENDA.find(([j]) => j === p.janela) || [, p.janela])[1]);

// Semanas inteiras (de domingo a sábado) que cobrem o mês
function gradeDoMes(mes) {
  const primeiro = `${mes}-01`;
  const inicio = somarDias(primeiro, -new Date(primeiro + 'T12:00:00Z').getUTCDay());
  const ultimo = new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).toISOString().slice(0, 10);
  const fim = somarDias(ultimo, 6 - new Date(ultimo + 'T12:00:00Z').getUTCDay());
  return [inicio, fim];
}

export async function abrirAgenda(dia = diaEscolhido || primeiraDataAberta()) {
  diaEscolhido = dia;
  mesVisivel = dia.slice(0, 7);
  await carregarMes();
}

export async function carregarMes() {
  const [inicio, fim] = gradeDoMes(mesVisivel);
  try {
    pedidos = await ApiClient.agenda(inicio, fim);
  } catch (e) {
    pedidos = [];
    $('#ag-erro').textContent = 'Não foi possível carregar a agenda. Verifique a conexão.';
  }
  rAgenda();
}

export function mudarMes(delta) {
  const [ano, mes] = mesVisivel.split('-').map(Number);
  const novo = new Date(Date.UTC(ano, mes - 1 + delta, 1)).toISOString().slice(0, 7);
  diaEscolhido = `${novo}-01`;
  mesVisivel = novo;
  return carregarMes();
}

export function escolherDia(dia) {
  diaEscolhido = dia;
  if (dia.slice(0, 7) !== mesVisivel) {
    mesVisivel = dia.slice(0, 7);
    return carregarMes();
  }
  rAgenda();
}

export function lembrarRegistradoPor(nome) {
  try { localStorage.setItem(CHAVE_REGISTRADO_POR, nome); } catch (e) {}
}

function prazoDoDia() {
  const hoje = hojeEmSaoPaulo(), amanha = somarDias(hoje, 1);
  if (!prazoDaAgendaPermite(diaEscolhido)) {
    return `Prazo encerrado para ${ddmm(diaEscolhido)}: pedidos para o dia seguinte só até as 13:00 do dia anterior.` +
      (podeUsarExcecao() ? ' Se for estritamente necessário, use a Exceção da Coordenação.' : '');
  }
  return horaEmSaoPaulo() < '13:00'
    ? `Pedidos para amanhã (${ddmm(amanha)}) até hoje às 13:00.`
    : `Prazo para amanhã (${ddmm(amanha)}) encerrado às 13:00: pedidos a partir de ${ddmm(somarDias(hoje, 2))}.`;
}

function calendarioHTML() {
  const [inicio, fim] = gradeDoMes(mesVisivel);
  const ativos = pedidos.filter(p => !p.cancelada_em);
  const dias = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${mesVisivel}-15T12:00:00Z`));
  const nomeDoMes = mes.charAt(0).toUpperCase() + mes.slice(1);
  return `<div class="cal-cab">
      <button class="x" type="button" data-cal="mes" data-delta="-1" aria-label="Mês anterior">‹</button>
      <b>${nomeDoMes}</b>
      <button class="x" type="button" data-cal="mes" data-delta="1" aria-label="Próximo mês">›</button>
    </div>
    <div class="cal">${SEMANA.map(s => `<span class="sem">${s}</span>`).join('')}${dias.map(d => {
      const qtd = ativos.filter(p => p.data === d).length;
      const classes = ['dia', d.slice(0, 7) !== mesVisivel && 'fora', !prazoDaAgendaPermite(d) && 'fechado', d === diaEscolhido && 'sel'].filter(Boolean).join(' ');
      return `<button type="button" class="${classes}" data-cal="dia" data-dia="${d}" aria-label="${dataPorExtenso(d)}${qtd ? `: ${qtd} pedido(s)` : ''}">${+d.slice(8)}${qtd ? `<span class="qtd">${qtd}</span>` : ''}</button>`;
    }).join('')}</div>`;
}

// Na data aberta no topo, a situação de cada pedido: já importado para a demanda ou ainda não (nas outras datas a
// demanda não está carregada)
const importado = p => (S.importadas || []).includes(p.id);
const pendentesDaDataAberta = () => (diaEscolhido === DATA ? pedidos.filter(p => p.data === DATA && !p.cancelada_em && !importado(p)) : []);
function situacao(p) {
  // Cancelado: a etiqueta numa linha; quem cancelou e quando ficam na dica (e para o leitor de tela)
  if (p.cancelada_em) {
    const detalhe = `por ${esc(p.cancelada_por)} em ${quando(p.cancelada_em)}`;
    return `<span class="tag" title="Cancelado ${detalhe}">Cancelado</span><span class="sr"> ${detalhe}</span>`;
  }
  if (p.data !== DATA) return '';
  return importado(p) ? '<span class="tag grp">Na demanda</span>' : '<span class="tag fb">Ainda não importado</span>';
}

function listaHTML() {
  const doDia = pedidos.filter(p => p.data === diaEscolhido);
  if (!doDia.length) return '<p class="h">Nenhum pedido para esta data.</p>';
  // Uma linha por pedido: a observação fica sob o nome do aluno e a conta que registrou, na dica de "Registrado por"
  // (quase sempre é a mesma em todas as linhas)
  return `<table><thead><tr><th>Registrado em</th><th>Aluno</th><th>Fase / missão</th><th>Disponibilidade</th><th>Registrado por</th><th>Situação</th><th></th></tr></thead>
    <tbody>${doDia.map(p => `<tr${p.cancelada_em ? ' class="cancel"' : ''}>
      <td>${quando(p.registrado_em)}</td>
      <td><b>${esc(p.aluno_nome)}</b>${p.observacao ? `<small class="obs">${esc(p.observacao)}</small>` : ''}</td>
      <td>${esc(p.missao)}</td>
      <td>${esc(disponibilidade(p))}</td>
      <td class="por"${p.conta && p.conta !== p.registrado_por ? ` title="Conta: ${esc(p.conta)}"` : ''}>${esc(p.registrado_por)}${p.excecao ? ' <span class="tag fb">Exceção da coordenação</span>' : ''}</td>
      <td class="situacao">${situacao(p)}</td>
      <td>${p.cancelada_em ? '' : `<button class="x agenda-acao" data-act="cancelar-pedido" data-id="${p.id}">Cancelar</button>`}</td>
    </tr>`).join('')}</tbody></table>`;
}

export function rAgenda() {
  if (!diaEscolhido) return;
  $('#agenda-prazo').textContent = prazoDoDia();
  $('#agenda-data').textContent = dataPorExtenso(diaEscolhido);
  $('#agenda-cal').innerHTML = calendarioHTML();
  $('#agenda-lista').innerHTML = listaHTML();
  const pendentes = pendentesDaDataAberta().length;
  $('#agenda-importar').hidden = !pendentes || !podeImportar();
  $('#agenda-importar').textContent = `Importar ${pendentes} ${pendentes === 1 ? 'pedido' : 'pedidos'} para a demanda`;

  // Formulário: alunos do cadastro, missões, disponibilidade e quem anotou (lembrado neste computador)
  const aluno = $('#ag-aluno').value;
  $('#ag-aluno').innerHTML = `<option value="">Escolha o aluno…</option>` +
    [...S.stu].sort((a, b) => a.nm.localeCompare(b.nm)).map(s => `<option value="${s.id}">${esc(s.nm)}</option>`).join('');
  $('#ag-aluno').value = aluno;
  if (!$('#ag-missao').options.length) {
    $('#ag-missao').innerHTML = opts(Object.keys(MIS).map(m => [m, m]), 'Voo Local');
    $('#ag-janela').innerHTML = opts(JANELAS_DA_AGENDA, 'manha');
    $('#ag-horario').innerHTML = opts(WIN.map(w => [w, w]), WIN[0]);
    try { $('#ag-por').value = localStorage.getItem(CHAVE_REGISTRADO_POR) || ''; } catch (e) {}
  }
  $('#ag-horario-rotulo').hidden = $('#ag-janela').value !== 'horario';
  const aberto = prazoDaAgendaPermite(diaEscolhido);
  $('#form-agenda [type="submit"]').disabled = !aberto;
  $('#ag-excecao').hidden = aberto || !podeUsarExcecao();
}
