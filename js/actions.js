// Ações que alteram o estado: perfil de acesso, data da escala, desfazer, histórico de alterações, geração da
// escala, BI e "Preencher exemplo".
import { WIN, NI, GROUND_EQ_TYPE, GROUND_DURATION_H, SIM_EQ_TYPES, MIS, DEFAULT_LIM } from './config.js';
import { pad, isoMenosDias, fimDoMes } from './format.js';
import { blank } from './rules.js';
import { habilitacoesDoNivel } from './habilitacoes.js';
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

export function save() {
  if (isGestor()) return;
  ApiClient.salvarDia(DATA, S, RES);
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
  setRES(escala);
  setAuditLog(historico);
  limparDesfazer();
  rRec(); rIns(); rAlu(); rDem(); renderAuditPanel(); rOut(false);
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
  if (RES) gen(false);
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

export function gen(switchTab = true) {
  // A escala guarda a data para a qual foi gerada (no modo compartilhado, todos veem essa data)
  setRES({ ...runAllocationEngine(S), data: DATA });
  ApiClient.salvarDia(DATA, S, RES);
  syncBIHistoryForCurrentDate();
  rRevisao();
  rOut(switchTab);
  renderAuditPanel();
  rBI();
}

export const demo = () => {
  if (isGestor()) return;
  pushHistory();
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(r() * a.length)];
  const wt = [0,0,1,1,1,2,2,3,4,4,5,6,6,7];
  const poolMis = ['Simulador','Voo Local','Voo Local','Navegação','Navegação','Voo Solo','IFR','Multimotor','Noturno'];

  // Se não houver nenhum instrutor cadastrado, cria 40 instrutores fictícios (habilitações dos níveis A01–A09 em ciclo)
  if (!S.ins.length) {
    S.ins = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      nm: `Instrutor ${String(i + 1).padStart(2, '0')}`,
      on: true,
      hab: habilitacoesDoNivel((i % 9) + 1),
      kg: 55 + ((i * 17) % 45),
      aw: WIN.map(() => true)
    }));
  }

  // Se não houver nenhum aluno cadastrado, cria 20 alunos de exemplo com pesos realistas
  if (!S.stu.length) {
    S.stu = Array.from({ length: 20 }, (_, i) => ({
      id: S.nid++,
      nm: pad(i),
      kg: 62 + Math.floor(r() * 28),
      bl: [],
      extra: [],
      ...blank()
    }));
  }

  S.stu.forEach((d, idx) => {
    d.extra = [];
    // Aluno 01 exemplifica Ground PA-34 (com instrutor A01+) às 06:30 + Multimotor PA-34 (instrutor A09) às 08:20
    if (idx === 0) {
      Object.assign(d, {
        fly: true, mis: 'Ground PA-34', eq: GROUND_EQ_TYPE, p1: 0, p2: 1, nb: GROUND_DURATION_H, ss: 1, pr: 5,
        extra: [
          { mid: S.nid++, fly: true, mis: 'Multimotor', eq: 'PA-34', p1: 1, p2: 2, nb: 2, ss: 1, pr: 5 },
          { mid: S.nid++, fly: true, mis: 'Noturno', eq: 'C172', p1: NI, p2: NI, nb: 1, ss: 1, pr: 5 }
        ]
      });
      return;
    }
    // Alunos 02 a 07 (6 alunos) exemplificam uma turma coletiva de Ground C152 no mesmo horário com o mesmo instrutor A01
    if (idx >= 1 && idx <= 6) {
      Object.assign(d, {
        fly: true, mis: 'Ground C152', eq: GROUND_EQ_TYPE, p1: 0, p2: 1, nb: GROUND_DURATION_H, ss: 1, pr: 4,
        extra: idx <= 3 ? [
          { mid: S.nid++, fly: true, mis: 'Voo Local', eq: 'C152', p1: 1, p2: 2, nb: 1, ss: 1, pr: 4 }
        ] : []
      });
      return;
    }
    // Aluno 08 exemplifica missão de Parafuso no PR-JPL (C152 Acrobat)
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
  save(); rIns(); rAlu(); rDem();
  logChange('inc', 'Demanda preenchida com exemplo (Ground A01+ e turmas coletivas)');
  showToast('Exemplo operacional carregado.');
};
