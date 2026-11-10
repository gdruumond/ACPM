// Ações que alteram o estado: perfil de acesso, desfazer, histórico de alterações, geração da escala,
// sincronização do BI e "Preencher exemplo".
import { NI, GROUND_EQ_TYPE, GROUND_DURATION_H, SIM_EQ_TYPES, MIS, DEFAULT_LIM } from './config.js';
import { pad } from './format.js';
import { blank } from './rules.js';
import { runAllocationEngine } from './engine.js';
import { ApiClient } from './storage.js';
import { S, RES, AUDIT_LOG, BI_HISTORY, setS, setRES, isGestor } from './state.js';
import { $, showToast } from './dom.js';
import { rBI } from './views/bi.js';
import { renderAuditPanel, rOut } from './views/escala.js';
import { rDem } from './views/demanda.js';
import { rIns, rAlu } from './views/cadastros.js';
import { rRec } from './views/recursos.js';

const historyStack = [];

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
  const dtInput = $('#dt');
  if (dtInput) dtInput.disabled = isGestor();
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
  ApiClient.saveState(S);
}

export function logChange(type, desc, revertAction = null) {
  if (isGestor()) return;
  const now = new Date();
  const entry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    ts: now.toTimeString().slice(0, 8),
    type,
    desc,
    revert: revertAction
  };
  AUDIT_LOG.unshift(entry);
  if (AUDIT_LOG.length > 100) AUDIT_LOG.pop();
  ApiClient.saveAudit(AUDIT_LOG);
  renderAuditPanel();
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

export function syncBIHistoryForCurrentDate() {
  if (ApiClient.readOnly) return;
  const dtVal = $('#dt') ? $('#dt').value : '';
  if (dtVal && RES) {
    BI_HISTORY[dtVal] = {
      out: RES.out.map(o => ({ ...o })),
      tot: RES.tot,
      rej: RES.al.filter(a => a.t === 'err').length
    };
    ApiClient.saveBI(BI_HISTORY);
  }
}

export function gen(switchTab = true) {
  // A escala guarda a data para a qual foi gerada (no modo compartilhado, todos veem essa data)
  setRES({ ...runAllocationEngine(S), data: $('#dt').value });
  ApiClient.saveResult(RES);
  syncBIHistoryForCurrentDate();
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
  save(); rAlu(); rDem();
  logChange('inc', 'Demanda preenchida com exemplo (Ground A01+ e turmas coletivas)');
  showToast('Exemplo operacional carregado.');
};
