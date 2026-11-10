// Aba 5 · Demanda: pedidos de missão por aluno (inclusive missões extras) e filtros.
import { NI, T, GROUND_DURATION_MIN, ACROBAT_REG, MIS, GROUND_EQ_TYPE } from '../config.js';
import { hm, esc, opts, wopt } from '../format.js';
import { isGroundMission, DISPONIBILIDADES, rotuloDaDisponibilidade } from '../rules.js';
import { descreverExigencias } from '../habilitacoes.js';
import { S } from '../state.js';
import { $ } from '../dom.js';
import { renderAuditPanel } from './escala.js';

export const sum = d => {
  if (!d.fly) return '';
  const disponibilidade = d.jan ? ` · Disponibilidade: ${rotuloDaDisponibilidade(d.jan)}` : '';
  return resumoDoHorario(d) + disponibilidade;
};

function resumoDoHorario(d) {
  const isGnd = isGroundMission(d.mis);
  if (isGnd) {
    const lvTag = ` · 01h30 · Turma coletiva · Exige ${descreverExigencias(d.mis, GROUND_EQ_TYPE)}`;
    if (d.p1 < 0) return `Livre${lvTag}`;
    const s = T[d.p1], e = s + GROUND_DURATION_MIN;
    return `${hm(s)}–${hm(e)}${lvTag}` + ((d.p1 == NI || e > T[NI]) ? ' ⚠ horário' : '');
  }
  const H = d.nb, K = Math.min(d.ss || 1, H);
  const L = Array.from({ length: K }, (_, j) => Math.floor(H / K) + (j < H % K ? 1 : 0));
  const nt = d.mis === 'Noturno';
  const lvTag = ` · Exige ${descreverExigencias(d.mis, d.eq)}${d.mis === 'Parafuso' && d.eq === 'C152' ? ' (' + ACROBAT_REG + ')' : ''}`;
  if (K > 1) return `${H} h em ${K} sessões (${L.join('h+') + 'h'})${lvTag}`;
  if (d.p1 < 0) return `${H} h, livre${lvTag}`;
  const s = T[d.p1], e = s + H * 60;
  return `${hm(s)}–${hm(e)}${lvTag}` + ((nt !== (d.p1 == NI) || e > (nt ? 1440 : T[NI])) ? ' ⚠ horário' : '');
}

export function allowedEqOptionsForMission(mis, currentEq) {
  const m = MIS[mis] || MIS['Voo Local'];
  return opts(m.eq.map(eq => [eq, eq]), currentEq);
}

export const singleDemandRowHTML = (stu, d, mid = 0) => {
  const isExtra = mid !== 0;
  const isGnd = isGroundMission(d.mis);
  const trCls = `${d.fly ? 'on p' + d.pr : 'off'}${isExtra ? ' extra-row' : ''}`;
  const firstCell = isExtra
    ? `<div class="stu-cell"><span class="sm">↳ ${esc(stu.nm)} (missão extra)</span><button class="x edit-only" data-act="del-mis" data-id="${stu.id}" data-mid="${mid}" title="Remover esta missão extra">✕</button></div>`
    : `<div class="stu-cell"><span>${esc(stu.nm)}</span><button class="btn-add-mis edit-only" data-act="add-mis" data-id="${stu.id}" title="Adicionar outra missão para este aluno no mesmo dia">+ Missão</button></div>`;

  const nbOpts = isGnd
    ? `<select data-f="nb" disabled title="Ground School tem duração fixa de 01h30"><option value="1.5" selected>01h30</option></select>`
    : `<select data-f="nb">${opts(Array.from({ length: 11 }, (_, i) => [i + 1, (i + 1) + ' h']), d.nb)}</select>`;

  const ssOpts = isGnd
    ? `<select data-f="ss" disabled><option value="1" selected>1</option></select>`
    : `<select data-f="ss">${opts([[1, '1'], [2, '2'], [3, '3']].filter(o => o[0] <= d.nb), Math.min(d.ss || 1, d.nb))}</select>`;

  return `<tr data-k="d" data-id="${stu.id}" data-mid="${mid}" data-nm="${esc(stu.nm.toLowerCase())}" data-mis="${esc(d.mis)}" class="${trCls}">
    <td>${firstCell}</td>
    <td><input type="checkbox" data-f="fly"${d.fly ? ' checked' : ''} aria-label="Vai voar"></td>
    <td><select data-f="mis">${opts(Object.keys(MIS).map(m => [m, m]), d.mis)}</select></td>
    <td><select data-f="eq"${isGnd ? ' disabled' : ''}>${allowedEqOptionsForMission(d.mis, d.eq)}</select></td>
    <td><select data-f="p1">${wopt(d.p1, 1)}</select></td>
    <td><select data-f="p2">${wopt(d.p2, 1)}</select></td>
    <td><select data-f="jan" aria-label="Disponibilidade do aluno">${opts(DISPONIBILIDADES, d.jan || '')}</select></td>
    <td>${nbOpts}</td>
    <td>${ssOpts}</td>
    <td><select data-f="pr">${opts([1, 2, 3, 4, 5].map(n => [n, n]), d.pr)}</select></td>
    <td class="sm">${sum(d)}</td>
  </tr>`;
};

export const studentDemandRowsHTML = stu => {
  let html = singleDemandRowHTML(stu, stu, 0);
  if (Array.isArray(stu.extra) && stu.extra.length) {
    html += stu.extra.map(ex => singleDemandRowHTML(stu, ex, ex.mid)).join('');
  }
  return html;
};

export const cnt = () => {
  let activeMissions = 0;
  let activeStudents = 0;
  S.stu.forEach(s => {
    const extraActive = (s.extra || []).filter(ex => ex.fly).length;
    const totStu = (s.fly ? 1 : 0) + extraActive;
    if (totStu > 0) activeStudents++;
    activeMissions += totStu;
  });
  $('#cnt').textContent = `${activeStudents} / ${S.stu.length} aluno(s) · ${activeMissions} missão(ões) marcada(s)`;
};

export const rDem = () => {
  if (!S.stu.length) {
    $('#dem').innerHTML = `<tr class="empty-dem"><td colspan="11" class="h" style="padding:16px">Nenhum aluno cadastrado. Cadastre alunos em “3 · Alunos” ou clique em “Preencher exemplo” acima para testar a escala.</td></tr>`;
    cnt();
    renderAuditPanel();
    return;
  }
  $('#dem').innerHTML = S.stu.map(studentDemandRowsHTML).join('');
  cnt();
  applyDemandFilters();
  renderAuditPanel();
};

export function applyDemandFilters() {
  const q = ($('#flt-dem') && $('#flt-dem').value || '').toLowerCase();
  const mis = $('#flt-dem-mis') ? $('#flt-dem-mis').value : '';
  document.querySelectorAll('#dem tr[data-k="d"]').forEach(tr => {
    const matchName = !q || tr.dataset.nm.includes(q);
    const matchMis = !mis || tr.dataset.mis === mis;
    tr.hidden = !(matchName && matchMis);
  });
}
