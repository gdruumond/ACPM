// Aba 6 · Dashboard BI: horas por equipamento, instrutor e missão (dia, semana e mês).
import { EQ, GROUND_EQ_TYPE, GROUND_REG, ACROBAT_REG, MIS } from '../config.js';
import { fmtH, A, esc } from '../format.js';
import { isGroundMission, migrateLegacyMissionName } from '../rules.js';
import { S, BI_HISTORY } from '../state.js';
import { $ } from '../dom.js';

// Renderizador do Dashboard Business Intelligence (BI)
export function getDaysDiff(d1Str, d2Str) {
  const d1 = new Date(d1Str + 'T12:00:00');
  const d2 = new Date(d2Str + 'T12:00:00');
  return Math.round((d1 - d2) / 86400000);
}

export function rBI() {
  const container = $('#bi-content');
  if (!container) return;

  const refDate = ($('#bi-dt') && $('#bi-dt').value) || ($('#dt') && $('#dt').value) || new Date().toISOString().slice(0, 10);
  const refMonth = refDate.slice(0, 7);
  const fltEqType = $('#bi-flt-eq') ? $('#bi-flt-eq').value : '';
  const fltInsQ = ($('#bi-flt-ins') && $('#bi-flt-ins').value || '').toLowerCase();

  const eqStats = {};
  Object.entries(EQ).forEach(([type, list]) => {
    list.forEach(reg => { eqStats[reg] = { reg, type, d: 0, w: 0, m: 0, flightsM: 0 }; });
  });
  eqStats[GROUND_REG] = { reg: GROUND_REG, type: GROUND_EQ_TYPE, d: 0, w: 0, m: 0, flightsM: 0 };

  const insStats = {};
  S.ins.forEach(x => { insStats[x.nm] = { nm: x.nm, lv: x.lv, on: x.on, d: 0, w: 0, m: 0, flightsM: 0 }; });

  const misStats = {};
  Object.keys(MIS).forEach(m => { misStats[m] = { mis: m, d: 0, w: 0, m: 0 }; });

  let totH_D = 0, totH_W = 0, totH_M = 0;
  let totF_D = 0, totF_W = 0, totF_M = 0;
  let daysRecordedInMonth = 0;

  Object.entries(BI_HISTORY).forEach(([dt, record]) => {
    if (!record || !Array.isArray(record.out)) return;
    const isDay = dt === refDate;
    const diffDays = getDaysDiff(refDate, dt);
    const isWeek = diffDays >= 0 && diffDays < 7;
    const isMonth = dt.slice(0, 7) === refMonth;

    if (isMonth && record.out.length > 0) daysRecordedInMonth++;

    // Deduplica turmas coletivas de Ground School no mesmo dia para somar 1,5 h uma única vez por turma
    const seenDayClasses = new Set();

    record.out.forEach(o => {
      if (o.status === 'Cancelado') return;
      const h = +o.h || 0;
      const normMis = migrateLegacyMissionName(o.mis);
      const isGnd = Boolean(o.isGround || isGroundMission(normMis));
      const cKey = o.classKey || `${dt}_${o.w}_${o.a}_${normMis}_${o.ins}`;

      if (isGnd) {
        if (seenDayClasses.has(cKey)) return;
        seenDayClasses.add(cKey);
      }

      if (isDay) { totH_D += h; totF_D++; }
      if (isWeek) { totH_W += h; totF_W++; }
      if (isMonth) { totH_M += h; totF_M++; }

      if (!eqStats[o.r]) eqStats[o.r] = { reg: o.r, type: o.eqType || 'Outro', d: 0, w: 0, m: 0, flightsM: 0 };
      if (isDay) eqStats[o.r].d += h;
      if (isWeek) eqStats[o.r].w += h;
      if (isMonth) { eqStats[o.r].m += h; eqStats[o.r].flightsM++; }

      if (!insStats[o.ins]) insStats[o.ins] = { nm: o.ins, lv: o.lv || 1, on: true, d: 0, w: 0, m: 0, flightsM: 0 };
      if (isDay) insStats[o.ins].d += h;
      if (isWeek) insStats[o.ins].w += h;
      if (isMonth) { insStats[o.ins].m += h; insStats[o.ins].flightsM++; }

      if (!misStats[normMis]) misStats[normMis] = { mis: normMis, d: 0, w: 0, m: 0 };
      if (isDay) misStats[normMis].d += h;
      if (isWeek) misStats[normMis].w += h;
      if (isMonth) misStats[normMis].m += h;
    });
  });

  const eqList = Object.values(eqStats)
    .filter(e => !fltEqType || e.type === fltEqType)
    .sort((a, b) => b.m - a.m || b.w - a.w || b.d - a.d || a.reg.localeCompare(b.reg));

  const insList = Object.values(insStats)
    .filter(x => !fltInsQ || x.nm.toLowerCase().includes(fltInsQ))
    .sort((a, b) => b.m - a.m || b.w - a.w || b.d - a.d || a.nm.localeCompare(b.nm));

  const maxEqM = Math.max(1, ...eqList.map(e => e.m));
  const maxInsM = Math.max(1, ...insList.map(x => x.m));
  const maxMisM = Math.max(1, ...Object.values(misStats).map(m => m.m));
  const fmtDateBR = refDate.split('-').reverse().join('/');

  container.innerHTML = `
    <div class="st">
      <div><strong>${fmtH(totH_D)}</strong>No Dia (${fmtDateBR})<small>${totF_D} voos/aulas ativas</small></div>
      <div><strong>${fmtH(totH_W)}</strong>Na Semana (7d)<small>${totF_W} voos/aulas ativas</small></div>
      <div><strong>${fmtH(totH_M)}</strong>No Mês (${refMonth.split('-').reverse().join('/')})<small>${daysRecordedInMonth} dias registrados</small></div>
      <div><strong>${Object.values(S.av).filter(Boolean).length}/${Object.keys(S.av).length}</strong>Frota Ativa<small>${S.ins.filter(x => x.on).length}/${S.ins.length} instrutores</small></div>
    </div>

    <div class="bi-grid-2">
      <div class="pn">
        <h3>Horas por Equipamento / Sala (Dia · Semana · Mês)</h3>
        <div class="tw" style="max-height:440px;overflow-y:auto">
          <table style="min-width:100%">
            <thead><tr><th>Equipamento</th><th>Frota</th><th>Dia</th><th>Semana</th><th>Mês</th><th>Uso</th></tr></thead>
            <tbody>
              ${eqList.map(e => {
                const pct = Math.round((e.m / maxEqM) * 100);
                const disp = (e.reg !== GROUND_REG && !S.av[e.reg]) ? ' <span class="tag fb">Manut.</span>' : '';
                const acro = e.reg === ACROBAT_REG ? ' <span class="tag">Acrobat</span>' : '';
                return `<tr>
                  <td><b>${esc(e.reg)}</b>${acro}${disp}</td>
                  <td class="sm">${esc(e.type)}</td>
                  <td><b>${fmtH(e.d)}</b></td>
                  <td>${fmtH(e.w)}</td>
                  <td><b>${fmtH(e.m)}</b></td>
                  <td><div class="bi-bar-wrap"><div class="bi-bar-fill" style="width:${pct}%"></div></div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="pn">
        <h3>Horas por Instrutor (Dia · Semana · Mês)</h3>
        <div class="tw" style="max-height:440px;overflow-y:auto">
          <table style="min-width:100%">
            <thead><tr><th>Instrutor</th><th>Nível</th><th>Dia</th><th>Semana</th><th>Mês</th><th>Carga</th></tr></thead>
            <tbody>
              ${insList.map(x => {
                const pct = Math.round((x.m / maxInsM) * 100);
                return `<tr>
                  <td><b>${esc(x.nm)}</b></td>
                  <td><span class="tag">${A(x.lv)}</span></td>
                  <td><b>${fmtH(x.d)}</b></td>
                  <td>${fmtH(x.w)}</td>
                  <td><b>${fmtH(x.m)}</b></td>
                  <td><div class="bi-bar-wrap"><div class="bi-bar-fill" style="width:${pct}%"></div></div></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="pn">
      <h3>Horas por Fase / Missão</h3>
      <div class="tw">
        <table style="min-width:100%">
          <thead><tr><th>Missão</th><th>Equipamento Permitido</th><th>Nível Base</th><th>Dia</th><th>Semana</th><th>Mês</th><th>Proporção</th></tr></thead>
          <tbody>
            ${Object.values(misStats).map(ms => {
              const rule = MIS[ms.mis] || MIS['Voo Local'];
              const eqDesc = ms.mis === 'Parafuso'
                ? 'C152 (PR-JPL) / C172 / PA-34'
                : rule.eq.join(' / ');
              const pct = Math.round((ms.m / maxMisM) * 100);
              return `<tr>
                <td><b>${esc(ms.mis)}</b></td>
                <td>${esc(eqDesc)}</td>
                <td><span class="tag">${A(rule.lv)}+</span></td>
                <td><b>${fmtH(ms.d)}</b></td>
                <td>${fmtH(ms.w)}</td>
                <td><b>${fmtH(ms.m)}</b></td>
                <td><div class="bi-bar-wrap"><div class="bi-bar-fill" style="width:${pct}%"></div></div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
