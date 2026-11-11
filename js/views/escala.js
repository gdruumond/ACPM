// Aba Escala: resumo do dia, a lista dos voos (ou o mapa por avião e sala ou por instrutor) e o histórico da data.
import { FLIGHT_STATUSES, GROUND_REG } from '../config.js';
import { hm, WLB, fmtH, esc } from '../format.js';
import { isGroundMission } from '../rules.js';
import { sumUniqueOperationalHours, consolidateTimelineSlots } from '../engine.js';
import { S, RES, AUDIT_LOG, TL_MODE, isGestor } from '../state.js';
import { $ } from '../dom.js';

export const HT = o => (o.isGround || isGroundMission(o.mis) ? '01h30 (1,5 h)' : o.h + ' h' + (o.ss !== '1/1' ? ` (sessão ${o.ss})` : ''));

export function missionColorClass(mis) {
  if (isGroundMission(mis)) return 'm-gnd';
  if (mis === 'Simulador') return 'm-sim';
  if (mis === 'Voo Local' || mis === 'Voo Solo') return 'm-pp';
  if (mis === 'Navegação' || mis === 'Parafuso' || mis === 'IFR') return 'm-pc';
  if (mis === 'Noturno') return 'm-nt';
  return 'm-mu';
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
      const pesoTxt = o.kg ? `${o.kg} kg` : '—';
      const isCollective = o.students.length > 1;
      const stuListTxt = isCollective ? `${o.students.length} alunos: ${o.students.join(', ')}` : o.s;

      return `<div class="tl-bar ${cls} tl-st-${stKey}" tabindex="0" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%">
        <div class="tl-bar-t1">${barLine1Fn(o)}</div>
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
      <div class="tl-lbl"><span>${esc(nomeDoRecurso(key))}</span> <small>${sub}</small></div>
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
        (first, totalH) => [first.r === GROUND_REG ? '' : first.eqType, fmtH(totalH)].filter(Boolean).join(' · '),
        o => o.students.length > 1
          ? `${hm(o.a)}–${hm(o.b)} · ${esc(o.mis)} (${o.students.length} alunos)`
          : `${hm(o.a)}–${hm(o.b)} · ${esc(o.s)}`,
        o => o.students.length > 1
          ? `${esc(o.ins)} · ${esc(o.students.join(', '))}`
          : `${esc(o.mis)} · ${esc(o.ins)}`,
        minStart,
        maxEnd
      );

  return `<div class="pn mapa">
    <div class="tl-legend">
      <span><i class="tl-dot m-gnd"></i>Ground School (01h30)</span>
      <span><i class="tl-dot m-sim"></i>Simulador</span>
      <span><i class="tl-dot m-pp"></i>Voo Local / Solo</span>
      <span><i class="tl-dot m-pc"></i>Navegação / Parafuso / IFR</span>
      <span><i class="tl-dot m-nt"></i>Noturno</span>
      <span><i class="tl-dot m-mu"></i>Multimotor</span>
      <span><i class="tl-dot tl-dot-emvoo"></i>Em voo</span>
      <span><i class="tl-dot tl-dot-pendente"></i>Pendente</span>
      <span><i class="tl-dot tl-dot-cancelado"></i>Cancelado</span>
    </div>
    ${chartHTML}
  </div>`;
}

// Histórico da data (na gaveta lateral) e o número de alterações no botão do topo
export function renderAuditPanel() {
  // Entradas revertidas (apontadas por uma reversão) não aparecem no painel
  const revertidas = new Set(AUDIT_LOG.map(e => e.reverte).filter(id => id !== null && id !== undefined));
  const historico = AUDIT_LOG.filter(e => !revertidas.has(e.id));
  const badgeCnt = $('#log-cnt');
  if (badgeCnt) badgeCnt.textContent = historico.length;

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

const PERTO_DO_LIMITE_KG = 10;
export const nomeDoRecurso = r => (r === GROUND_REG ? 'Sala Ground' : r);
const ehGround = o => o.isGround || isGroundMission(o.mis);
const duracao = o => (ehGround(o) ? '1h30' : fmtH(o.h)) + (o.ss && o.ss !== '1/1' ? ` · sessão ${o.ss}` : '');
const statusDe = o => (S.fStatus && S.fStatus[o.fKey]) || o.status || 'Confirmado';

// A preferência só aparece quando o voo não ficou na 1ª
function preferencia(o) {
  if (o.baseTag === 'Pref. 2') return ' <span class="tag">2ª preferência</span>';
  if (o.baseTag === 'Próximo livre') return ' <span class="tag fb">horário livre</span>';
  return '';
}

// Peso da tripulação só nos aviões, contra o limite (em destaque a menos de 10 kg dele)
function peso(o) {
  if (!o.limKg) return '';
  if (!o.kg) return '<span class="tag fb">sem peso</span>';
  return `<span class="${o.kg > o.limKg - PERTO_DO_LIMITE_KG ? 'perto' : ''}">${o.kg}</span> <span class="sm">/ ${o.limKg} kg</span>`;
}

function seletorDeStatus(o) {
  const st = statusDe(o);
  return `<select class="st-sel st-${st.replace(/\s+/g, '')}" data-f="fstatus" data-fkey="${o.fKey}" aria-label="Status de ${esc(o.s)}"${isGestor() ? ' disabled' : ''}>
    ${FLIGHT_STATUSES.map(v => `<option value="${v}"${v === st ? ' selected' : ''}>${v}</option>`).join('')}
  </select>`;
}

const acao = o => (o.stuId
  ? `<button class="x" data-act="rm-fly" data-id="${o.stuId}" data-mid="${o.mid || 0}" aria-label="Tirar ${esc(o.s)} da escala" title="Tirar da escala">✕</button>`
  : '');

// Avisos agrupados por tipo: alunos sem peso, aviões que param para a revisão e outros
function resumoDosAvisos(avisos) {
  const ehPeso = a => a.m.startsWith('Peso do aluno não informado');
  const ehRevisao = a => a.m.startsWith('Aeronave parou');
  const semPeso = new Set(avisos.filter(ehPeso).map(a => a.s.replace(/ \(.*\)$/, ''))).size;
  const revisao = avisos.filter(ehRevisao).length;
  const outros = avisos.filter(a => !ehPeso(a) && !ehRevisao(a)).length;
  const partes = [
    semPeso && `${semPeso} ${semPeso === 1 ? 'aluno sem peso' : 'alunos sem peso'}`,
    revisao && `${revisao} ${revisao === 1 ? 'avião para' : 'aviões param'} para a revisão de 50 horas`,
    outros && `${outros} ${outros === 1 ? 'outro' : 'outros'}`
  ].filter(Boolean);
  return `${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'}: ${partes.join(' · ')}`;
}

function resumo(out, al, tot) {
  const erros = al.filter(a => a.t === 'err');
  const avisos = al.filter(a => a.t !== 'err');
  const horas = sumUniqueOperationalHours(out, statusDe);
  const item = a => `<li class="al ${a.t}"><b>${esc(a.s)}</b> ${esc(a.m)}</li>`;
  const nomes = [...new Set(erros.map(a => a.s))].join(', ');
  let h = `<div class="resumo">
    <div class="st">
      <div><strong>${tot}</strong> missões pedidas</div>
      <div><strong>${tot - erros.length}</strong> escaladas</div>
      <div><strong>${fmtH(horas)}</strong> de voo e aula</div>
    </div>`;
  if (erros.length) {
    h += `<details class="caixa erros" open><summary>${erros.length === 1 ? '1 missão não entrou' : `${erros.length} missões não entraram`} na escala: ${esc(nomes)}</summary>
      <ul>${erros.map(item).join('')}</ul></details>`;
  }
  if (avisos.length) h += `<details class="caixa avisos"><summary>${resumoDosAvisos(avisos)}</summary><ul>${avisos.map(item).join('')}</ul></details>`;
  return h + '</div>';
}

// Uma linha por voo. Na turma de Ground, horário, missão, sala e instrutor aparecem uma vez; cada aluno tem a
// sua linha, com o seu status e a sua ação
function tabela(voos) {
  const grupos = [];
  const turmas = new Map();
  for (const o of voos) {
    const chave = ehGround(o) && o.classKey ? o.classKey : null;
    if (chave && turmas.has(chave)) { turmas.get(chave).push(o); continue; }
    const grupo = [o];
    if (chave) turmas.set(chave, grupo);
    grupos.push(grupo);
  }
  const porTempo = {};
  grupos.forEach(g => { porTempo[g[0].w] = (porTempo[g[0].w] || 0) + 1; });

  let h = `<div class="tw tabela-escala"><table><thead><tr><th>Horário</th><th>Aluno</th><th>Missão</th><th>Avião / sala</th><th>Instrutor</th><th>Peso</th><th>Status</th><th class="edit-only" aria-label="Ação"></th></tr></thead><tbody>`;
  let tempo = -1;
  for (const grupo of grupos) {
    const o = grupo[0];
    if (o.w !== tempo) {
      tempo = o.w;
      const n = porTempo[o.w];
      h += `<tr class="win"><td colspan="8">${WLB(o.w)} <small>${n} ${n === 1 ? 'decolagem ou aula' : 'decolagens e aulas'}</small></td></tr>`;
    }
    const rs = grupo.length > 1 ? ` rowspan="${grupo.length}"` : '';
    const cancelado = voo => (statusDe(voo) === 'Cancelado' ? ' class="st-Cancelado"' : '');
    h += `<tr${cancelado(o)}>
      <td class="c-hr hr"${rs}>${hm(o.a)}–${hm(o.b)} <small>${duracao(o)}</small>${preferencia(o)}</td>
      <td class="c-aluno"><b>${esc(o.s)}</b></td>
      <td class="c-missao"${rs}>${esc(o.mis)}${grupo.length > 1 ? ` <small>Turma de ${grupo.length} alunos</small>` : ''}</td>
      <td class="c-aviao nw"${rs}>${esc(nomeDoRecurso(o.r))}${ehGround(o) ? '' : ` <small>${esc(o.eqType || '')}</small>`}</td>
      <td class="c-instr nw"${rs}>${esc(o.ins)}</td>
      <td class="c-peso nw"${rs}>${peso(o)}</td>
      <td class="c-status">${seletorDeStatus(o)}</td>
      <td class="c-acao edit-only acao">${acao(o)}</td>
    </tr>`;
    for (const aluno of grupo.slice(1)) {
      h += `<tr class="membro${statusDe(aluno) === 'Cancelado' ? ' st-Cancelado' : ''}"><td class="c-aluno"><b>${esc(aluno.s)}</b></td><td class="c-status">${seletorDeStatus(aluno)}</td><td class="c-acao edit-only acao">${acao(aluno)}</td></tr>`;
    }
  }
  return h + '</tbody></table></div>';
}

// A escala é refeita a cada alteração (save em actions.js): aqui ela só é desenhada, na visão escolhida na barra
export function rOut() {
  document.querySelectorAll('#s-esc [data-tl]').forEach(b => b.classList.toggle('on', b.dataset.tl === TL_MODE));
  $('#out').dataset.vista = TL_MODE === 'lista' ? 'lista' : 'mapa';
  if (!RES || (!RES.out.length && !RES.al.length)) {
    $('#out').innerHTML = `<p class="h">Nenhum voo nesta data. Marque quem vai voar na aba Demanda: a escala é montada automaticamente.</p>`;
    return;
  }
  const { out, al, tot } = RES;

  const eqFilterEl = $('#flt-esc-eq');
  const curEqFilter = eqFilterEl ? eqFilterEl.value : '';
  if (eqFilterEl) {
    const usados = [...new Set(out.map(o => o.r))].sort();
    eqFilterEl.innerHTML = `<option value="">Todos os aviões e salas (${usados.length})</option>` +
      usados.map(r => `<option value="${r}"${r === curEqFilter ? ' selected' : ''}>${esc(nomeDoRecurso(r))}</option>`).join('');
  }
  const qFilter = ($('#flt-esc-q') && $('#flt-esc-q').value || '').toLowerCase();
  const voos = out.filter(o => {
    if (curEqFilter && o.r !== curEqFilter) return false;
    if (qFilter && !o.s.toLowerCase().includes(qFilter) && !o.ins.toLowerCase().includes(qFilter) && !o.mis.toLowerCase().includes(qFilter)) return false;
    return true;
  });

  let h = resumo(out, al, tot);
  if (!voos.length) h += `<p class="h">${tot ? 'Nenhum voo na escala com esses filtros.' : 'Nenhuma missão marcada na Demanda.'}</p>`;
  else h += tabela(voos) + renderVisualTimeline(voos);
  $('#out').innerHTML = h;
}
