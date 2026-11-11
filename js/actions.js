// Ações que alteram o estado: perfil de acesso, data da escala, desfazer, histórico de alterações, geração da
// escala e BI.
import { DEFAULT_LIM } from './config.js';
import { isoMenosDias, fimDoMes } from './format.js';
import { runAllocationEngine } from './engine.js';
import { ApiClient } from './storage.js';
import { S, RES, AUDIT_LOG, BI_HISTORY, DATA, setS, setRES, setAuditLog, setBIHistory, setData, isGestor } from './state.js';
import { $, showToast } from './dom.js';
import { rBI } from './views/bi.js';
import { renderAuditPanel, rOut } from './views/escala.js';
import { rDem } from './views/demanda.js';
import { rIns, rAlu } from './views/cadastros.js';
import { rRec, rRevisao } from './views/recursos.js';
import { podeEditarAgenda } from './views/agenda.js';

const historyStack = [];

// Abre uma data na tela (a data da escala e a data base do BI)
export function abrirData(data) {
  setData(data);
  $('#dt').value = data;
  $('#bi-dt').value = data;
}

export function setRole(role, lockShared = false) {
  if (lockShared) ApiClient.readOnly = true;
  const validRole = (ApiClient.readOnly || role === 'gestor') ? 'gestor' : 'operador';
  document.body.setAttribute('data-role', validRole);
  if (ApiClient.readOnly) {
    document.body.setAttribute('data-shared', 'true');
  }
  const sel = $('#role-sel');
  if (sel) {
    if (ApiClient.readOnly) {
      sel.innerHTML = '<option value="gestor" selected>🔒 Gestor (Somente Leitura)</option>';
      sel.value = 'gestor';
      sel.disabled = true;
      sel.title = 'Link compartilhado: visualização exclusiva no perfil Gestor';
    } else {
      sel.value = validRole;
    }
  }
  // No modo compartilhado o gestor navega entre as datas (somente leitura)
  const dtInput = $('#dt');
  if (dtInput) dtInput.disabled = isGestor() && document.body.dataset.backend !== 'supabase';
  // Agenda: quem pode registrar pedidos (operadores e secretaria; no modo local, fora do perfil Gestor)
  document.body.dataset.agenda = podeEditarAgenda() ? 'edita' : 'consulta';
}

export function limparDesfazer() {
  historyStack.length = 0;
  const btnUndo = $('#btn-undo');
  if (btnUndo) btnUndo.disabled = true;
}

export function pushHistory() {
  if (isGestor()) return;
  historyStack.push(JSON.stringify(S));
  if (historyStack.length > 30) historyStack.shift();
  const btnUndo = $('#btn-undo');
  if (btnUndo) btnUndo.disabled = false;
}

// A escala acompanha os dados: cada alteração do operador refaz a escala da data (o motor leva milissegundos) e
// grava os dados e a escala juntos. Ao abrir a aba Escala, ela já está pronta
export function save() {
  if (isGestor()) return;
  refazerEscala();
  ApiClient.salvarDia(DATA, S, RES);
  escalaSoCalculada = false;
}

// Escala só calculada (data aberta ainda sem escala gravada): é gravada na primeira alteração ou quando é exportada
// (CSV ou PDF), para entrar no BI e nas horas e no rodízio da data seguinte. Abrir uma data não grava nada
let escalaSoCalculada = false;
export const marcarEscalaSoCalculada = valor => { escalaSoCalculada = valor; };
export function gravarEscalaCalculada() {
  if (escalaSoCalculada) save();
}

// A entrada aparece na hora; o id (que permite reverter) chega quando o registro é gravado.
// reverte: id da entrada que esta alteração desfaz (ela deixa de aparecer no painel)
export function logChange(type, desc, revertAction = null, reverte = null) {
  if (isGestor()) return;
  const entry = {
    id: null,
    ts: new Date().toTimeString().slice(0, 8),
    type,
    desc,
    revert: revertAction,
    reverte,
    autor: ApiClient.autorAtual,
    importado: false
  };
  AUDIT_LOG.unshift(entry);
  renderAuditPanel();
  ApiClient.registrarHistorico(DATA, { tipo: type, descricao: desc, reverter: revertAction, reverte }).then(id => {
    if (id === null || id === undefined) return;
    entry.id = id;
    renderAuditPanel();
  });
}

// Entradas importadas (anteriores à fase 3) mostram também o dia em que foram feitas
function horario(iso, importado) {
  const d = new Date(iso);
  const hora = d.toTimeString().slice(0, 8);
  return importado ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hora.slice(0, 5)}` : hora;
}

export async function historicoParaPainel(data) {
  return (await ApiClient.historicoDoDia(data)).map(e => ({
    id: e.id,
    ts: horario(e.registrado_em, e.importado),
    type: e.tipo,
    desc: e.descricao,
    revert: e.importado ? null : e.reverter,
    reverte: e.reverte,
    autor: e.autor,
    importado: e.importado
  }));
}

// Abre a escala de uma data (uma troca rápida de data descarta a resposta da troca anterior)
let pedidoDeData = 0;
export async function carregarData(data) {
  const pedido = ++pedidoDeData;
  const { estado, escala } = await ApiClient.carregarDia(data);
  const historico = await historicoParaPainel(data);
  if (pedido !== pedidoDeData) return;
  abrirData(data);
  setS(estado);
  // Data sem escala gravada (por exemplo, uma data nova, copiada da anterior): a escala calculada aparece na hora
  // e é gravada junto com a primeira alteração
  setRES(escala || escalaCalculada());
  escalaSoCalculada = !escala;
  setAuditLog(historico);
  limparDesfazer();
  rRec(); rIns(); rAlu(); rDem(); renderAuditPanel(); rOut();
  await carregarBI();
}

// BI das escalas guardadas no mês da data base (e nos 7 dias até ela), com a escala da tela já incluída.
// Sem conexão, o BI continua como estava
let pedidoDeBI = 0;
export async function carregarBI() {
  const ref = $('#bi-dt').value || DATA;
  const inicioMes = ref.slice(0, 8) + '01';
  const inicioSemana = isoMenosDias(ref, 6);
  const pedido = ++pedidoDeBI;
  let bi;
  try {
    bi = await ApiClient.biDoPeriodo(inicioSemana < inicioMes ? inicioSemana : inicioMes, fimDoMes(ref));
  } catch (e) {
    return;
  }
  if (pedido !== pedidoDeBI) return;
  setBIHistory(bi);
  syncBIHistoryForCurrentDate();
  rBI();
}

export function undoLastAction() {
  if (isGestor() || !historyStack.length) return;
  setS(JSON.parse(historyStack.pop()));
  S.lim = { ...DEFAULT_LIM };
  save();
  $('#btn-undo').disabled = historyStack.length === 0;
  logChange('mod', 'Ação desfeita pelo botão Desfazer');
  rRec(); rIns(); rAlu(); rDem();
  showToast('Última alteração desfeita.');
}

// O BI em memória acompanha a escala da tela (que pode ainda estar sendo gravada)
export function syncBIHistoryForCurrentDate() {
  if (ApiClient.readOnly) return;
  if (!DATA) return;
  if (RES) {
    BI_HISTORY[DATA] = {
      out: RES.out.map(o => ({ ...o })),
      tot: RES.tot,
      rej: RES.al.filter(a => a.t === 'err').length
    };
  } else {
    delete BI_HISTORY[DATA];
  }
}

// Escala da data calculada a partir dos dados da tela. Ela guarda a data para a qual foi feita (no modo
// compartilhado, todos veem essa data)
export const escalaCalculada = () => ({ ...runAllocationEngine(S), data: DATA });

// Refaz a escala e o que depende dela (revisão de 50 horas, painel do dia e BI), sem gravar: quem grava é save
export function refazerEscala() {
  setRES(escalaCalculada());
  syncBIHistoryForCurrentDate();
  rRevisao();
  rOut();
  renderAuditPanel();
  rBI();
}
