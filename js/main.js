/**
 * Escala de Voo — ACPM: ponto de entrada (eventos da interface e inicialização).
 *
 *   js/config.js    Configurações operacionais (janelas, frota, missões, níveis A01–A09, limites)
 *   js/rules.js     Regras das missões (Ground School, nível mínimo, precedência, normalização)
 *   js/format.js    Formatação de horários, durações e opções de seleção
 *   js/engine.js    Motor de alocação determinístico (função pura)
 *   js/storage.js   Camada de dados (localStorage, migrações e link compartilhado)
 *   js/state.js     Estado compartilhado entre os módulos
 *   js/actions.js   Perfil de acesso, desfazer, histórico, gerar escala e exemplo
 *   js/dom.js       Utilitários de DOM
 *   js/views/       Renderização das abas (recursos, cadastros, demanda, escala, BI e navegação)
 *   js/export.js    Exportação CSV e PDF
 */
import { WIN, NI, T, EQ, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, GROUND_DURATION_H, ACROBAT_REG, MIS, PRE } from './config.js';
import { hm, fmtDurLabel, pad, A } from './format.js';
import { isGroundMission, reqInsLevel, blank } from './rules.js';
import { ApiClient } from './storage.js';
import { S, RES, AUDIT_LOG, BI_HISTORY, setS, setRES, setAuditLog, setBIHistory, setTLMode, isGestor, insBy, stuBy, getMissionTarget } from './state.js';
import { $, showToast, msg, focusLast } from './dom.js';
import { show } from './views/tabs.js';
import { rBI } from './views/bi.js';
import { renderAuditPanel, rOut } from './views/escala.js';
import { singleDemandRowHTML, cnt, rDem, applyDemandFilters } from './views/demanda.js';
import { insHTML, stuHTML, rIns, rAlu, applyInstructorFilters } from './views/cadastros.js';
import { rRec } from './views/recursos.js';
import { setRole, pushHistory, save, logChange, undoLastAction, syncBIHistoryForCurrentDate, gen, demo } from './actions.js';
import { exp, pdf } from './export.js';

const activeTimers = new WeakMap();

document.addEventListener('click', e => {
  const g = e.target.closest('[data-t],[data-go]');
  if (g) {
    show(g.dataset.t || g.dataset.go);
    try { window.scrollTo(0, 0); } catch (x) {}
    return;
  }
  const tlBtn = e.target.closest('[data-tl]');
  if (tlBtn) {
    setTLMode(tlBtn.dataset.tl);
    rOut(false);
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'flt-dem') { applyDemandFilters(); return; }
  if (e.target.id === 'flt-esc-q') { rOut(false); return; }
  if (e.target.id === 'bi-flt-ins') { rBI(); return; }
  if (e.target.dataset.flt === 'inst') { applyInstructorFilters(); return; }
  const f = e.target.dataset.flt;
  if (!f) return;
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#' + f + ' .cd').forEach(c => {
    c.hidden = !c.querySelector('.nm').value.toLowerCase().includes(q);
  });
});

const armed = (id, txt, fn) => {
  $(id).onclick = e => {
    if (isGestor()) return;
    const b = e.target, o = b.dataset.o || (b.dataset.o = b.textContent);
    if (activeTimers.has(b)) clearTimeout(activeTimers.get(b));
    if (!b.dataset.arm) {
      b.dataset.arm = 1; b.textContent = txt;
      const tid = setTimeout(() => { b.dataset.arm = ''; b.textContent = o; activeTimers.delete(b); }, 3500);
      activeTimers.set(b, tid);
      return;
    }
    b.dataset.arm = ''; b.textContent = o; activeTimers.delete(b); fn();
  };
};

$('#gen').onclick = $('#gen2').onclick = () => { if (!isGestor()) gen(true); };
$('#exp').onclick = exp;
$('#pdf').onclick = pdf;
$('#btn-undo').onclick = undoLastAction;

$('#role-sel').onchange = e => {
  if (ApiClient.readOnly) {
    setRole('gestor', true);
    return;
  }
  setRole(e.target.value);
  if (RES) rOut(false);
};

$('#btn-share-link').onclick = async () => {
  const dtVal = $('#dt') ? $('#dt').value : '';
  const url = ApiClient.encodeShareableURL(S, dtVal);
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link de Gestor (somente leitura) copiado!');
  } catch (e) {
    prompt('Copie o link abaixo (abre bloqueado no perfil Gestor):', url);
  }
};

$('#btn-open-log').onclick = () => {
  show('esc');
  const p = $('#audit-panel');
  if (p) { p.open = true; p.scrollIntoView({ behavior: 'smooth' }); }
};

$('#btn-clear-log').onclick = () => {
  if (isGestor()) return;
  setAuditLog([]);
  ApiClient.saveAudit(AUDIT_LOG);
  renderAuditPanel();
  showToast('Histórico limpo.');
};

$('#dt').onchange = e => {
  if (isGestor()) return;
  if ($('#bi-dt')) $('#bi-dt').value = e.target.value;
  if (RES) gen(false);
  else rBI();
};
$('#bi-dt').onchange = () => rBI();
$('#bi-flt-eq').onchange = () => rBI();
$('#flt-dem-mis').onchange = applyDemandFilters;
$('#flt-ins-lv').onchange = applyInstructorFilters;
$('#flt-esc-eq').onchange = () => rOut(false);

$('#btn-theme').onclick = () => {
  const root = document.documentElement;
  const cur = root.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem(ApiClient.KEY_THEME, next); } catch (e) {}
};

armed('#demo', 'Confirmar exemplo', demo);
armed('#clr', 'Confirmar limpeza', () => {
  if (isGestor()) return;
  pushHistory();
  S.stu.forEach(d => { Object.assign(d, blank()); d.extra = []; });
  save(); rDem();
  logChange('exc', 'Demanda limpa');
  if (RES) gen(false);
});

armed('#btn-bi-sim', 'Confirmar simulação', () => {
  if (isGestor()) return;
  const refStr = ($('#bi-dt') && $('#bi-dt').value) || ($('#dt') && $('#dt').value);
  const baseDate = new Date(refStr + 'T12:00:00');
  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const allMis = Object.keys(MIS);
  const stuPool = S.stu.length ? S.stu : Array.from({ length: 15 }, (_, i) => ({ nm: pad(i) }));

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const d = new Date(baseDate.getTime() - dayOffset * 86400000);
    const iso = d.toISOString().slice(0, 10);
    if (dayOffset === 0 && RES && RES.out.length) continue;

    const flights = [];
    const numFlights = 10 + Math.floor(rnd() * 14);
    for (let f = 0; f < numFlights; f++) {
      const mis = pick([...allMis, 'Voo Local', 'Voo Local', 'Navegação', 'IFR']);
      const isGnd = isGroundMission(mis);
      const eqType = isGnd ? GROUND_EQ_TYPE : pick(MIS[mis].eq);
      const reg = isGnd
        ? GROUND_REG
        : (mis === 'Parafuso' && eqType === 'C152')
          ? ACROBAT_REG
          : pick(EQ[eqType].filter(r => r !== ACROBAT_REG));
      const minLv = reqInsLevel(mis, eqType);
      const qualIns = isGnd
        ? S.ins.filter(x => x.lv === 1 || x.lv === 2)
        : S.ins.filter(x => x.lv >= minLv);
      const ins = pick(qualIns.length ? qualIns : S.ins);
      const stu = pick(stuPool);
      const h = isGnd ? GROUND_DURATION_H : 1 + Math.floor(rnd() * 3);
      const durMin = isGnd ? GROUND_DURATION_MIN : h * 60;
      const w = mis === 'Noturno' ? 8 : Math.floor(rnd() * 7);
      flights.push({
        isGround: isGnd,
        classKey: isGnd ? `SIM_${iso}_${mis}_${w}_${ins.id}` : `SIM_${iso}_${f}`,
        w, a: T[w], b: T[w] + durMin,
        s: stu.nm, mis, h, ss: '1/1',
        r: reg, eqType, ins: ins.nm, lv: ins.lv, status: 'Confirmado'
      });
    }
    BI_HISTORY[iso] = { out: flights, tot: numFlights, rej: 0 };
  }
  ApiClient.saveBI(BI_HISTORY);
  rBI();
  showToast('Histórico de 30 dias simulado.');
});

armed('#btn-bi-clr', 'Confirmar limpeza', () => {
  if (isGestor()) return;
  setBIHistory({});
  ApiClient.saveBI(BI_HISTORY);
  rBI();
  showToast('Histórico BI zerado.');
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (isGestor()) { e.preventDefault(); return; }
  const a = b.dataset.act, c = b.closest('[data-k]'), id = c ? +c.dataset.id : +b.dataset.id || 0;
  const mid = b.dataset.mid !== undefined ? +b.dataset.mid : (c && c.dataset.mid !== undefined ? +c.dataset.mid : 0);

  if (a === 'add-mis') {
    const s = stuBy(id);
    if (!s) return;
    pushHistory();
    if (!Array.isArray(s.extra)) s.extra = [];
    const newEx = {
      mid: S.nid++,
      fly: true,
      mis: 'Voo Local',
      eq: 'C152',
      p1: 4,
      p2: 6,
      nb: 1,
      ss: 1,
      pr: s.pr || 3
    };
    s.extra.push(newEx);
    save();
    rDem();
    logChange('inc', `Missão extra adicionada para ${s.nm}`);
    if (RES) gen(false);
    showToast(`Nova missão adicionada para ${s.nm}.`);
    return;
  }

  if (a === 'del-mis') {
    const s = stuBy(id);
    if (!s || !Array.isArray(s.extra)) return;
    pushHistory();
    s.extra = s.extra.filter(ex => ex.mid !== mid);
    save();
    rDem();
    logChange('exc', `Missão extra removida de ${s.nm}`);
    if (RES) gen(false);
    return;
  }

  if (a === 'rm-fly') {
    const s = stuBy(id);
    const target = getMissionTarget(id, mid);
    if (!s || !target || !target.fly) return;
    pushHistory();
    target.fly = false;
    save();
    logChange('exc', `${s.nm} excluído da escala (${target.mis} · ${target.eq})`, {
      kind: 'setFly', stuId: s.id, mid, val: true, label: '↶ Restaurar'
    });
    rDem();
    gen(false);
    msg(`Inclusão de ${s.nm} (${target.mis}) removida.`);
    return;
  }

  if (a === 'rev-log') {
    const logId = +b.dataset.logid;
    const entryIdx = AUDIT_LOG.findIndex(x => x.id === logId);
    if (entryIdx < 0 || !AUDIT_LOG[entryIdx].revert) return;
    const rev = AUDIT_LOG[entryIdx].revert;
    pushHistory();

    if (rev.kind === 'setFly') {
      const st = stuBy(rev.stuId);
      const target = getMissionTarget(rev.stuId, rev.mid || 0);
      if (st && target) {
        target.fly = rev.val;
        AUDIT_LOG.splice(entryIdx, 1);
        ApiClient.saveAudit(AUDIT_LOG);
        logChange(rev.val ? 'inc' : 'exc', `Revertido: ${st.nm} (${target.mis})`);
        save(); rDem(); gen(false);
      }
    } else if (rev.kind === 'setAv') {
      S.av[rev.reg] = rev.val;
      AUDIT_LOG.splice(entryIdx, 1);
      ApiClient.saveAudit(AUDIT_LOG);
      save(); rRec(); if (RES) gen(false);
    } else if (rev.kind === 'setInsOn') {
      const ins = insBy(rev.insId);
      if (ins) {
        ins.on = rev.val;
        AUDIT_LOG.splice(entryIdx, 1);
        ApiClient.saveAudit(AUDIT_LOG);
        save(); rIns(); if (RES) gen(false);
      }
    }
    return;
  }

  if (a === 'addi') {
    pushHistory();
    const newIns = { id: S.nid++, nm: 'Novo instrutor', on: true, lv: 1, kg: 0, aw: WIN.map((_, i) => i < 8) };
    S.ins.push(newIns);
    save(); rIns(); rAlu(); focusLast('#inst .nm');
    logChange('inc', `Instrutor adicionado: ${newIns.nm}`);
  } else if (a === 'adds') {
    pushHistory();
    const newStu = { id: S.nid++, nm: 'Novo aluno', kg: 0, bl: [], extra: [], ...blank() };
    S.stu.push(newStu);
    save(); rAlu(); rDem(); focusLast('#alu .nm');
    logChange('inc', `Aluno cadastrado: ${newStu.nm}`);
  } else if (a === 'unbl') {
    pushHistory();
    const s = stuBy(id);
    const blkIns = insBy(+b.dataset.b);
    s.bl = s.bl.filter(v => v !== +b.dataset.b);
    save(); c.outerHTML = stuHTML(s);
    logChange('mod', `Desbloqueado ${blkIns ? blkIns.nm : ''} para ${s.nm}`);
  } else if (a === 'deli' || a === 'dels') {
    if (activeTimers.has(b)) clearTimeout(activeTimers.get(b));
    if (!b.dataset.arm) {
      b.dataset.arm = 1; b.textContent = 'Confirmar'; b.classList.add('arm');
      const tid = setTimeout(() => { b.dataset.arm = ''; b.textContent = '✕'; b.classList.remove('arm'); activeTimers.delete(b); }, 3000);
      activeTimers.set(b, tid);
      return;
    }
    activeTimers.delete(b);
    pushHistory();
    if (a === 'deli') {
      const target = insBy(id);
      S.ins = S.ins.filter(x => x.id !== id);
      S.stu.forEach(s => s.bl = s.bl.filter(v => v !== id));
      logChange('exc', `Instrutor excluído: ${target ? target.nm : id}`);
    } else {
      const target = stuBy(id);
      S.stu = S.stu.filter(x => x.id !== id);
      logChange('exc', `Aluno excluído: ${target ? target.nm : id}`);
    }
    save(); rIns(); rAlu(); rDem();
    if (RES) gen(false);
  }
});

// Sincronização em tempo real de alterações (com trava estrita para Perfil Gestor e Links Compartilhados)
document.addEventListener('change', e => {
  const t = e.target, f = t.dataset.f, a = t.dataset.a;
  if (t.id === 'onlyfly') { $('#dem').classList.toggle('only', t.checked); return; }

  // Trava de segurança: impede qualquer mutação de estado se estiver em modo Gestor
  if ((a || f) && isGestor()) {
    e.preventDefault();
    rRec(); rIns(); rAlu(); rDem();
    if (RES) rOut(false);
    return;
  }

  if (f === 'fstatus') {
    const fkey = t.dataset.fkey;
    if (!S.fStatus) S.fStatus = {};
    S.fStatus[fkey] = t.value;
    let flightDesc = fkey;
    if (RES && Array.isArray(RES.out)) {
      const targetFlight = RES.out.find(o => o.fKey === fkey);
      if (targetFlight) {
        targetFlight.status = t.value;
        flightDesc = `${targetFlight.s} (${hm(targetFlight.a)}–${hm(targetFlight.b)})`;
      }
      ApiClient.saveResult(RES);
    }
    save();
    syncBIHistoryForCurrentDate();
    logChange('mod', `Status de ${flightDesc}: ${t.value}`);
    rOut(false);
    rBI();
    return;
  }

  if (a) {
    pushHistory();
    if (a === 'win') {
      const idx = +t.dataset.i;
      S.win[idx] = t.checked;
      logChange(t.checked ? 'inc' : 'exc', `Janela ${WIN[idx]} ${t.checked ? 'ativa' : 'inativa'}`);
    } else if (a === 'av') {
      const reg = t.dataset.id;
      S.av[reg] = t.checked;
      logChange(t.checked ? 'inc' : 'exc', `${reg}: ${t.checked ? 'Disponível' : 'Manutenção'}`, {
        kind: 'setAv', reg, val: !t.checked, label: '↶ Reverter'
      });
    }
    save(); rRec();
    if (RES) gen(false);
    return;
  }

  const c = t.closest('[data-k]');
  if (!c || !f) return;
  pushHistory();
  const k = c.dataset.k, id = +c.dataset.id;
  const mid = c.dataset.mid !== undefined ? +c.dataset.mid : 0;

  if (k === 'i') {
    const x = insBy(id);
    if (f === 'on') {
      x.on = t.checked;
      logChange(t.checked ? 'inc' : 'exc', `${x.nm}: ${t.checked ? 'Disponível' : 'Indisponível'}`, {
        kind: 'setInsOn', insId: x.id, val: !t.checked, label: '↶ Reverter'
      });
    } else if (f === 'nm') {
      const old = x.nm;
      x.nm = t.value.trim() || x.nm;
      logChange('mod', `Instrutor: ${old} → ${x.nm}`);
    } else if (f === 'kg') {
      x.kg = +t.value || 0;
      logChange('mod', `Peso ${x.nm}: ${x.kg} kg`);
    } else if (f === 'lv') {
      x.lv = +t.value;
      logChange('mod', `Nível ${x.nm}: ${A(x.lv)}`);
    } else if (f === 'aw') {
      x.aw[+t.dataset.w] = t.checked;
    } else if (f === 'pre') {
      if (!t.value) return;
      x.aw = WIN.map((_, i) => PRE[t.value].includes(i));
    }
    save(); c.outerHTML = insHTML(x);
    if (f === 'nm') rAlu();
    if (RES) gen(false);
  } else {
    const s = stuBy(id);
    if (k === 's') {
      if (f === 'nm') {
        const old = s.nm;
        s.nm = t.value.trim() || s.nm;
        logChange('mod', `Aluno: ${old} → ${s.nm}`);
      } else if (f === 'kg') {
        s.kg = +t.value || 0;
        logChange('mod', `Peso ${s.nm}: ${s.kg} kg`);
      } else if (f === 'bl' && t.value) {
        s.bl.push(+t.value);
        const ins = insBy(+t.value);
        logChange('exc', `${s.nm} bloqueou ${ins ? ins.nm : ''}`);
      }
      save(); c.outerHTML = stuHTML(s);
      if (f === 'nm') rDem();
      if (RES) gen(false);
    } else {
      const target = getMissionTarget(id, mid);
      if (!target) return;
      if (f === 'fly') {
        target.fly = t.checked;
        logChange(
          target.fly ? 'inc' : 'exc',
          `${s.nm} ${target.fly ? 'incluído' : 'retirado'} (${target.mis} · ${target.eq} · ${fmtDurLabel(target.nb)})`,
          { kind: 'setFly', stuId: s.id, mid, val: !target.fly, label: target.fly ? '✕ Excluir' : '↶ Restaurar' }
        );
      } else {
        target[f] = (f === 'mis' || f === 'eq') ? t.value : +t.value;
        if (f === 'mis') {
          const mRule = MIS[target.mis] || MIS['Voo Local'];
          if (!mRule.eq.includes(target.eq)) {
            target.eq = mRule.defEq;
          }
          if (mRule.isGround) {
            target.eq = GROUND_EQ_TYPE;
            target.nb = GROUND_DURATION_H;
            target.ss = 1;
            if (target.p1 === NI) { target.p1 = 0; target.p2 = 1; }
          } else {
            if (+target.nb === GROUND_DURATION_H || !Number.isInteger(+target.nb)) target.nb = 1;
            if (target.mis === 'Noturno') {
              target.p1 = NI;
              target.p2 = NI;
            } else if (target.p1 === NI) {
              target.p1 = 1;
              target.p2 = 2;
            }
          }
        }
        if (f === 'nb' && !isGroundMission(target.mis)) {
          target.ss = Math.min(target.ss || 1, target.nb);
        }
        logChange('mod', `Pedido ${s.nm}: ${target.mis} · ${target.eq} · ${fmtDurLabel(target.nb)}`);
      }
      save();
      c.outerHTML = singleDemandRowHTML(s, target, mid);
      cnt();
      renderAuditPanel();
      if (RES) gen(false);
    }
  }
});

// Inicialização Assíncrona
(async function bootstrap() {
  try {
    const savedTheme = localStorage.getItem(ApiClient.KEY_THEME);
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  } catch (e) {}

  const t = new Date(Date.now() + 864e5);
  const isoTomorrow = new Date(t - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  $('#dt').value = isoTomorrow;
  $('#bi-dt').value = isoTomorrow;

  setS(await ApiClient.fetchState());
  setRES(await ApiClient.fetchResult());
  setAuditLog(await ApiClient.fetchAudit());
  setBIHistory(await ApiClient.fetchBI());

  const params = new URLSearchParams(window.location.search);
  const hasShare = params.has('share');
  const sharedDate = ApiClient.applySharedURLIfPresent(S);

  // Se aberto via link compartilhado, força bloqueio estrito no perfil Gestor sem permitir troca para Operador
  if (hasShare) {
    setRole('gestor', true);
  } else if (params.get('role')) {
    setRole(params.get('role'), false);
  }

  rRec(); rIns(); rAlu(); rDem(); renderAuditPanel();

  if (sharedDate) {
    $('#dt').value = sharedDate;
    $('#bi-dt').value = sharedDate;
    gen(true);
    showToast('Escala compartilhada carregada (Modo Gestor Somente Leitura).');
  } else if (RES) {
    rOut(false);
  }
  rBI();
})();
