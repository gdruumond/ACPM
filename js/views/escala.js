// Aba 5 · Escala: tabela oficial, mapa de ocupação e painel de inclusões e histórico do dia.
import { FLIGHT_STATUSES } from '../config.js';
import { hm, WLB, fmtH, fmtDurLabel, esc } from '../format.js';
import { isGroundMission } from '../rules.js';
import { sumUniqueOperationalHours, consolidateTimelineSlots } from '../engine.js';
import { S, RES, AUDIT_LOG, TL_MODE, isGestor } from '../state.js';
import { $ } from '../dom.js';
import { show } from './tabs.js';

export const HT = o => (o.isGround || isGroundMission(o.mis) ? '01h30 (1,5 h)' : o.h + ' h' + (o.ss !== '1/1' ? ` (sessão ${o.ss})` : ''));

export function missionColorClass(mis) {
  if (isGroundMission(mis)) return 'm-gnd';
  if (mis === 'Simulador') return 'm-sim';
  if (mis === 'Voo Local' || mis === 'Voo Solo') return 'm-pp';
  if (mis === 'Navegação' || mis === 'Parafuso' || mis === 'IFR') return 'm-pc';
  if (mis === 'Noturno') return 'm-nt';
  return 'm-mu';
}

export function statusPrefixIcon(st) {
  if (st === 'Em Voo') return '🛫 ';
  if (st === 'Pendente') return '⏳ ';
  if (st === 'Cancelado') return '✕ ';
  return '';
}

export function buildTimelineGroup(out, groupKey, subLabelFn, barLine1Fn, barLine2Fn, minStart, maxEnd) {
  const span = maxEnd - minStart;
  const groups = {};
  out.forEach(o => (groups[o[groupKey]] = groups[o[groupKey]] || []).push(o));

  const ticks = [];
  for (let m = minStart; m <= maxEnd; m += 60) ticks.push(`<span>${hm(m)}</span>`);

  const rowsHTML = Object.keys(groups).sort((a, b) => a.localeCompare(b)).map(key => {
    const rawFlights = groups[key];
    const activeH = sumUniqueOperationalHours(rawFlights, o => (S.fStatus && S.fStatus[o.fKey]) || o.status || 'Confirmado');
    const sub = subLabelFn(rawFlights[0], activeH);
    const consolidated = consolidateTimelineSlots(rawFlights);

    const bars = consolidated.map(o => {
      const left = ((o.a - minStart) / span) * 100;
      const width = ((o.b - o.a) / span) * 100;
      const cls = missionColorClass(o.mis);

      // Para turmas coletivas, verifica o status consolidado
      const activeItems = o.items.filter(it => ((S.fStatus && S.fStatus[it.fKey]) || it.status || 'Confirmado') !== 'Cancelado');
      const primaryItem = activeItems[0] || o.items[0];
      const stVal = activeItems.length === 0
        ? 'Cancelado'
        : ((S.fStatus && S.fStatus[primaryItem.fKey]) || primaryItem.status || 'Confirmado');
      const stKey = stVal.replace(/\s+/g, '');
      const icon = statusPrefixIcon(stVal);
      const pesoTxt = o.kg ? `${o.kg} kg` : '—';
      const isCollective = o.students.length > 1;
      const stuListTxt = isCollective ? `${o.students.length} alunos: ${o.students.join(', ')}` : o.s;

      return `<div class="tl-bar ${cls} tl-st-${stKey}" tabindex="0" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%">
        <div class="tl-bar-t1">${icon}${barLine1Fn(o)}</div>
        <div class="tl-bar-t2">${barLine2Fn(o)}</div>
        <div class="tl-pop">
          <div class="tl-pop-hd"><span>${hm(o.a)} – ${hm(o.b)}</span><span>${HT(o)}</span></div>
          <div class="tl-pop-grid">
            <span>${isCollective ? 'Turma:' : 'Aluno:'}</span><span>${esc(stuListTxt)}</span>
            <span>Instrutor:</span><span>${esc(o.ins)}</span>
            <span>Recurso:</span><span>${esc(o.r)}</span>
            <span>Missão:</span><span>${esc(o.mis)}</span>
            <span>Peso Trip.:</span><span>${pesoTxt}</span>
            <span>Status:</span>
            <span>
              <select class="st-sel st-${stKey}" data-f="fstatus" data-fkey="${primaryItem.fKey}" aria-label="Status do voo">
                ${FLIGHT_STATUSES.map(st => `<option value="${st}"${st === stVal ? ' selected' : ''}>${st}</option>`).join('')}
              </select>
            </span>
          </div>
          ${!isCollective && o.stuId ? `<button class="tl-pop-btn edit-only" data-act="rm-fly" data-id="${o.stuId}" data-mid="${o.mid || 0}">✕ Excluir da escala</button>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="tl-row">
      <div class="tl-lbl"><span>${esc(key)}</span><small>${sub}</small></div>
      <div class="tl-track">${bars}</div>
    </div>`;
  }).join('');

  return `<div class="tl-wrap"><div class="tl-axis">${ticks.join('')}</div>${rowsHTML}</div>`;
}

export function renderVisualTimeline(out) {
  if (!out.length) return '';
  const minStart = 360; // 06:00
  const maxEnd = Math.max(1080, ...out.map(o => o.b));

  const chartHTML = TL_MODE === 'ins'
    ? buildTimelineGroup(
        out,
        'ins',
        (first, totalH) => fmtH(totalH),
        o => o.students.length > 1
          ? `${hm(o.a)}–${hm(o.b)} · Turma (${o.students.length} alunos)`
          : `${hm(o.a)}–${hm(o.b)} · ${esc(o.r)}`,
        o => o.students.length > 1
          ? `${esc(o.mis)}: ${esc(o.students.join(', '))}`
          : `${esc(o.s)} · ${esc(o.mis)}`,
        minStart,
        maxEnd
      )
    : buildTimelineGroup(
        out,
        'r',
        (first, totalH) => `${first.eqType || ''} · ${fmtH(totalH)}`,
        o => o.students.length > 1
          ? `${hm(o.a)}–${hm(o.b)} · ${esc(o.mis)} (${o.students.length} alunos)`
          : `${hm(o.a)}–${hm(o.b)} · ${esc(o.s)}`,
        o => o.students.length > 1
          ? `${esc(o.ins)} · ${esc(o.students.join(', '))}`
          : `${esc(o.mis)} · ${esc(o.ins)}`,
        minStart,
        maxEnd
      );

  return `<div class="pn" style="margin-top:14px">
    <div class="tl-header">
      <h3 style="margin:0">Mapa de Ocupação</h3>
      <div class="tl-switch">
        <button data-tl="eq" class="${TL_MODE === 'eq' ? 'on' : ''}">✈ Por Aeronave / Sala</button>
        <button data-tl="ins" class="${TL_MODE === 'ins' ? 'on' : ''}">👨‍✈️ Por Instrutor</button>
      </div>
    </div>
    <div class="tl-legend">
      <span><i class="tl-dot m-gnd"></i>Ground School (01h30)</span>
      <span><i class="tl-dot m-sim"></i>Simulador</span>
      <span><i class="tl-dot m-pp"></i>Voo Local / Solo</span>
      <span><i class="tl-dot m-pc"></i>Navegação / Parafuso / IFR</span>
      <span><i class="tl-dot m-nt"></i>Noturno</span>
      <span><i class="tl-dot m-mu"></i>Multimotor</span>
      <span>🛫 Em Voo</span>
      <span>⏳ Pendente</span>
      <span>✕ Cancelado</span>
    </div>
    ${chartHTML}
  </div>`;
}

export function renderAuditPanel() {
  const activeItems = [];
  S.stu.forEach(s => {
    if (s.fly) activeItems.push({ stuId: s.id, mid: 0, nm: s.nm, mis: s.mis, eq: s.eq, nb: s.nb });
    if (Array.isArray(s.extra)) {
      s.extra.forEach(ex => {
        if (ex.fly) activeItems.push({ stuId: s.id, mid: ex.mid, nm: s.nm, mis: ex.mis, eq: ex.eq, nb: ex.nb });
      });
    }
  });

  const cntEl = $('#inc-active-cnt');
  if (cntEl) cntEl.textContent = activeItems.length;

  // Entradas revertidas (apontadas por uma reversão) não aparecem no painel
  const revertidas = new Set(AUDIT_LOG.map(e => e.reverte).filter(id => id !== null && id !== undefined));
  const historico = AUDIT_LOG.filter(e => !revertidas.has(e.id));
  const badgeCnt = $('#log-cnt');
  if (badgeCnt) badgeCnt.textContent = historico.length;

  const allocatedKeySet = new Set(RES ? RES.out.map(o => `${o.stuId}_${o.mid || 0}`) : []);

  const activeListEl = $('#inc-active-list');
  if (activeListEl) {
    if (!activeItems.length) {
      activeListEl.innerHTML = `<div class="audit-item"><span class="h">Nenhuma missão marcada.</span></div>`;
    } else {
      activeListEl.innerHTML = activeItems.map(d => {
        const isAlloc = allocatedKeySet.has(`${d.stuId}_${d.mid}`);
        const statusBadge = RES
          ? (isAlloc ? `<span class="audit-badge inc">Alocado</span>` : `<span class="audit-badge exc">Rejeitado</span>`)
          : `<span class="audit-badge mod">Pendente</span>`;
        return `<div class="audit-item">
          <div>${statusBadge} <b>${esc(d.nm)}</b> · ${esc(d.mis)} (${esc(d.eq)}) · ${fmtDurLabel(d.nb)}</div>
          <button class="x edit-only" data-act="rm-fly" data-id="${d.stuId}" data-mid="${d.mid}">✕ Excluir</button>
        </div>`;
      }).join('');
    }
  }

  const logListEl = $('#audit-log-list');
  if (logListEl) {
    if (!historico.length) {
      logListEl.innerHTML = `<div class="audit-item"><span class="h">Sem alterações registradas nesta data.</span></div>`;
    } else {
      logListEl.innerHTML = historico.map(item => {
        const lbl = item.type === 'inc' ? 'Inclusão' : item.type === 'exc' ? 'Exclusão' : 'Edição';
        const podeReverter = item.revert && item.id !== null && item.id !== undefined;
        const btnRevert = podeReverter
          ? `<button class="x edit-only" data-act="rev-log" data-logid="${item.id}">${esc(item.revert.label || '↶ Reverter')}</button>`
          : '';
        const autor = item.autor ? ` <span class="sm">${esc(item.autor)}</span>` : '';
        const importado = item.importado ? ' <span class="sm">(importado)</span>' : '';
        return `<div class="audit-item">
          <div><span class="sm">[${esc(item.ts)}]</span>${autor} <span class="audit-badge ${item.type}">${lbl}</span> <span>${esc(item.desc)}</span>${importado}</div>
          ${btnRevert}
        </div>`;
      }).join('');
    }
  }
}

export function rOut(switchTab = true) {
  if (!RES) {
    $('#out').innerHTML = `<p class="h">Ainda não há escala para esta data. Marque quem vai voar em “4 · Demanda” e clique em “Gerar escala”.</p>`;
    return;
  }
  const { out, al, tot } = RES;
  const rej = al.filter(a => a.t === 'err').length;

  const eqFilterEl = $('#flt-esc-eq');
  const curEqFilter = eqFilterEl ? eqFilterEl.value : '';
  if (eqFilterEl) {
    const usedRegs = [...new Set(out.map(o => o.r))].sort();
    eqFilterEl.innerHTML = `<option value="">Todos os equipamentos (${usedRegs.length})</option>` +
      usedRegs.map(r => `<option value="${r}"${r === curEqFilter ? ' selected' : ''}>${r}</option>`).join('');
  }
  const qFilter = ($('#flt-esc-q') && $('#flt-esc-q').value || '').toLowerCase();

  const filteredOut = out.filter(o => {
    if (curEqFilter && o.r !== curEqFilter) return false;
    if (qFilter && !o.s.toLowerCase().includes(qFilter) && !o.ins.toLowerCase().includes(qFilter) && !o.mis.toLowerCase().includes(qFilter)) return false;
    return true;
  });

  const winCount = {};
  filteredOut.forEach(o => { winCount[o.w] = (winCount[o.w] || 0) + 1; });

  const activeHours = sumUniqueOperationalHours(out, o => (S.fStatus && S.fStatus[o.fKey]) || o.status || 'Confirmado');

  let h = `<div class="st">
    <div><strong>${tot}</strong>missões na demanda</div>
    <div><strong>${tot - rej}</strong>atendidas</div>
    <div><strong>${fmtH(activeHours)}</strong>horas ativas</div>
    <div><strong style="color:${al.length ? 'var(--er)' : 'var(--ok)'}">${al.length}</strong>alertas</div>
  </div>`;

  h += al.map(a => `<div class="al ${a.t}"><b>${esc(a.s)}</b>${esc(a.m)}</div>`).join('');

  if (!filteredOut.length) {
    h += `<p class="h">${tot ? 'Nenhum voo alocado.' : 'Nenhuma missão marcada em “4 · Demanda”.'}</p>`;
  } else {
    // 1º: Tabela Oficial da Escala do Dia
    h += '<div class="tw" style="margin-top:10px"><table><thead><tr><th>Horário</th><th>Aluno</th><th>Missão</th><th>Equipamento</th><th>Instrutor</th><th>Duração</th><th>Peso</th><th>Encaixe</th><th>Status</th><th class="edit-only">Ação</th></tr></thead><tbody>';
    let cw = -1;
    for (const o of filteredOut) {
      if (o.w !== cw) {
        cw = o.w;
        h += `<tr class="win"><td colspan="10">${WLB(o.w)} · ${winCount[o.w]} lançamento(s) iniciando</td></tr>`;
      }
      const stVal = (S.fStatus && S.fStatus[o.fKey]) || o.status || 'Confirmado';
      const stKey = stVal.replace(/\s+/g, '');
      const rowCancelCls = stVal === 'Cancelado' ? ' class="st-Cancelado"' : '';
      const disabledAttr = isGestor() ? ' disabled' : '';
      const tagCls = o.groupSize > 1 ? ' grp' : (o.baseTag && o.baseTag[0] !== 'P' ? ' fb' : '');
      h += `<tr${rowCancelCls}>
        <td>${hm(o.a)}–${hm(o.b)}</td>
        <td><b>${esc(o.s)}</b></td>
        <td>${esc(o.mis)}</td>
        <td>${esc(o.r)}</td>
        <td>${esc(o.ins)}</td>
        <td>${HT(o)}</td>
        <td>${o.kg ? o.kg + ' kg' : '—'}</td>
        <td><span class="tag${tagCls}">${esc(o.tag)}</span></td>
        <td>
          <select class="st-sel st-${stKey}" data-f="fstatus" data-fkey="${o.fKey}" aria-label="Status do voo"${disabledAttr}>
            ${FLIGHT_STATUSES.map(st => `<option value="${st}"${st === stVal ? ' selected' : ''}>${st}</option>`).join('')}
          </select>
        </td>
        <td class="edit-only">${o.stuId ? `<button class="x" data-act="rm-fly" data-id="${o.stuId}" data-mid="${o.mid || 0}">✕</button>` : ''}</td>
      </tr>`;
    }
    h += '</tbody></table></div>';

    // 2º: Mapa Visual Interativo de Ocupação sincronizado logo após a tabela
    h += renderVisualTimeline(filteredOut);
  }

  $('#out').innerHTML = h;
  if (switchTab) show('esc');
}
