// Motor de alocação determinístico da escala do dia e utilitários de horas e de ocupação.
// runAllocationEngine é uma função pura: recebe o estado e devolve { out, al, tot } sem alterá-lo.
import { T, NI, DAY, NIGHT_OK, EQ, MIS, DEFAULT_LIM, ACROBAT_REG, GROUND_EQ_TYPE, GROUND_REG, GROUND_DURATION_MIN, GROUND_DURATION_H } from './config.js';
import { hm, A } from './format.js';
import { isGroundMission, reqInsLevel, doesGroundGateFlight } from './rules.js';

export function runAllocationEngine(state) {
  const used = {}, busy = {}, stuBusy = {}, stuLastPick = {}, load = {}, eu = {}, out = [], al = [];
  // Aeronaves/simuladores que cada instrutor já usou no dia, na ordem em que foram escalados
  const insAircraft = {};
  // Armazena turmas abertas de Ground School por missão para permitir múltiplos alunos no mesmo horário/instrutor
  const openGroundClasses = {};
  // Registra os Grounds agendados por aluno no dia para exigir precedência antes do respectivo voo
  const stuGroundStatus = {};

  // Monta fila de pedidos de missão (suporta múltiplas missões por aluno no mesmo dia)
  const act = [];
  state.stu.forEach((st, stuIdx) => {
    if (st.fly) {
      act.push({ stu: st, stuId: st.id, mid: 0, ref: st, stuOrder: stuIdx, misOrder: 0 });
    }
    if (Array.isArray(st.extra)) {
      st.extra.forEach((ex, exIdx) => {
        if (ex.fly) {
          act.push({ stu: st, stuId: st.id, mid: ex.mid, ref: ex, stuOrder: stuIdx, misOrder: exIdx + 1 });
        }
      });
    }
  });

  // Registra todos os Grounds que cada aluno tem marcados para hoje (para checar precedência nos voos)
  act.forEach(item => {
    if (isGroundMission(item.ref.mis)) {
      (stuGroundStatus[item.stuId] = stuGroundStatus[item.stuId] || []).push({
        mis: item.ref.mis,
        allocatedEnd: null
      });
    }
  });

  /**
   * Ordenação da Fila:
   * 1º: Missões de Ground School SEMPRE antes de missões de Voo/Simulador (garante a criação das turmas
   *     coletivas e define o horário de término do Ground antes de alocar o voo dependente do aluno).
   * 2º: Maior prioridade (5 a 1).
   * 3º: Ordem de cadastro do aluno e ordem da missão.
   */
  act.sort((a, b) => {
    const gA = isGroundMission(a.ref.mis) ? 1 : 0;
    const gB = isGroundMission(b.ref.mis) ? 1 : 0;
    if (gA !== gB) return gB - gA;
    return b.ref.pr - a.ref.pr || a.stuOrder - b.stuOrder || a.misOrder - b.misOrder;
  });

  const free = (mp, id, s, e) => !(mp[id] || []).some(([a, b]) => s < b && e > a);
  const cover = (aw, s, e) => T.every((c, k) => !(s < (k < NI ? T[k + 1] : 1440) && e > c) || aw[k]);

  for (const item of act) {
    const { stu, stuId, mid, ref: d, stuOrder } = item;
    const m = MIS[d.mis] || MIS['Voo Local'];
    const nm = stu.nm;
    const labelStu = mid ? `${nm} (${d.mis})` : nm;
    const isGnd = Boolean(m.isGround);

    // ========================================================================
    // RAMO A: ALOCAÇÃO DE GROUND SCHOOL (01h30 = 90 MIN · TURMA COLETIVA · A01+)
    // ========================================================================
    if (isGnd) {
      const reqLv = 1; // Sem restrição de instrutor: qualquer instrutor ativo A01+ pode ministrar Ground
      const durMin = GROUND_DURATION_MIN; // 90 min (1.5 h)
      const endMax = T[NI]; // 17:30 (1050 min)
      const starts = DAY.filter(w => state.win[w] && T[w] + durMin <= endMax);
      const pf = [+d.p1, +d.p2];

      // Se o aluno também tem um voo dependente hoje com horário preferido, prioriza janelas que terminem antes do voo
      const dependentFlights = act.filter(other => other.stuId === stuId && doesGroundGateFlight(d.mis, other.ref));
      const earliestFlightPrefMin = dependentFlights.reduce((minT, flt) => {
        const fp1 = +flt.ref.p1;
        return (fp1 >= 0 && T[fp1] < minT) ? T[fp1] : minT;
      }, Infinity);

      const candidateWins = [...new Set([...pf.filter(w => w >= 0), ...starts])].filter(w => starts.includes(w));
      // Prioriza janelas que terminam antes do voo preferido do aluno, mantendo a cascata Pref.1 -> Pref.2 -> Próximo livre
      candidateWins.sort((w1, w2) => {
        const ok1 = T[w1] + durMin <= earliestFlightPrefMin ? 0 : 1;
        const ok2 = T[w2] + durMin <= earliestFlightPrefMin ? 0 : 1;
        return ok1 - ok2;
      });

      const existingClasses = openGroundClasses[d.mis] || [];
      let chosenClass = null;

      // 1ª Tentativa: Unir-se a uma turma já aberta da mesma temática de Ground (mesmo horário e mesmo instrutor)
      const orderedExisting = [...existingClasses].sort((c1, c2) => {
        const inPref1 = (c1.w == d.p1 || c1.w == d.p2) ? 0 : 1;
        const inPref2 = (c2.w == d.p1 || c2.w == d.p2) ? 0 : 1;
        if (inPref1 !== inPref2) return inPref1 - inPref2;
        const okFlt1 = c1.b <= earliestFlightPrefMin ? 0 : 1;
        const okFlt2 = c2.b <= earliestFlightPrefMin ? 0 : 1;
        return okFlt1 - okFlt2;
      });

      for (const cls of orderedExisting) {
        if (!free(stuBusy, stuId, cls.a, cls.b)) continue;
        if (stu.bl.includes(cls.x.id)) continue;
        if (cls.b > earliestFlightPrefMin && candidateWins.some(w => T[w] + durMin <= earliestFlightPrefMin)) continue;
        chosenClass = cls;
        break;
      }

      // 2ª Tentativa: Abrir nova turma de Ground se não pôde ingressar em turma existente
      const fcGnd = { stu_busy: 0, sala: 0, disp: 0, busy: 0, bloq: 0 };
      if (!chosenClass) {
        // Verifica restrições de bloqueio de todos os alunos da mesma turma potencial para escolher um instrutor comum
        const cohortBlocked = new Set(stu.bl);
        act.forEach(other => {
          if (other.ref.mis === d.mis) other.stu.bl.forEach(bId => cohortBlocked.add(bId));
        });

        for (const w of candidateWins) {
          const a = T[w], b = a + durMin;
          if (!free(stuBusy, stuId, a, b)) { fcGnd.stu_busy++; continue; }

          const sameWinCls = existingClasses.find(c => c.w === w && !stu.bl.includes(c.x.id));
          if (sameWinCls) {
            chosenClass = sameWinCls;
            break;
          }

          // Há uma única sala de Ground: só abre turma nova com a sala livre durante toda a 01h30
          if (!free(used, GROUND_REG, a, b)) { fcGnd.sala++; continue; }

          const q = state.ins.filter(x => x.on && x.lv >= reqLv && cover(x.aw, a, b));
          if (!q.length) { fcGnd.disp++; continue; }

          const f1 = q.filter(x => free(busy, x.id, a, b));
          if (!f1.length) { fcGnd.busy++; continue; }

          const f2 = f1.filter(x => !stu.bl.includes(x.id));
          if (!f2.length) { fcGnd.bloq++; continue; }

          // Ordena instrutores priorizando: não bloqueado pela turma -> MENOR NÍVEL (A01 primeiro) -> menor carga no dia
          f2.sort((x1, x2) =>
            (cohortBlocked.has(x1.id) - cohortBlocked.has(x2.id)) ||
            (x1.lv - x2.lv) ||
            ((load[x1.id] || 0) - (load[x2.id] || 0))
          );

          const pickedIns = f2[0];
          const classKey = `GND_${d.mis}_${w}_${pickedIns.id}`;
          chosenClass = { classKey, mis: d.mis, w, a, b, x: pickedIns, count: 0 };
          (openGroundClasses[d.mis] = openGroundClasses[d.mis] || []).push(chosenClass);

          // Marca o instrutor e a sala ocupados neste intervalo (outros alunos do MESMO Ground entram via chosenClass)
          (busy[pickedIns.id] = busy[pickedIns.id] || []).push([a, b]);
          (used[GROUND_REG] = used[GROUND_REG] || []).push([a, b]);
          load[pickedIns.id] = (load[pickedIns.id] || 0) + GROUND_DURATION_H;
          eu[GROUND_REG] = (eu[GROUND_REG] || 0) + GROUND_DURATION_H;
          break;
        }
      }

      if (chosenClass) {
        chosenClass.count++;
        (stuBusy[stuId] = stuBusy[stuId] || []).push([chosenClass.a, chosenClass.b]);

        // Registra que o aluno concluiu este Ground às chosenClass.b (liberando voos a partir de chosenClass.b)
        const stGnds = stuGroundStatus[stuId] || [];
        const gRec = stGnds.find(g => g.mis === d.mis && g.allocatedEnd === null) || stGnds.find(g => g.mis === d.mis);
        if (gRec) gRec.allocatedEnd = chosenClass.b;

        const fKey = `${stuId}_${mid}_1`;
        const baseTag = chosenClass.w == d.p1 ? 'Pref. 1' : chosenClass.w == d.p2 ? 'Pref. 2' : 'Próximo livre';

        out.push({
          fKey,
          classKey: chosenClass.classKey,
          isGround: true,
          w: chosenClass.w, a: chosenClass.a, b: chosenClass.b,
          o: stuOrder,
          stuId,
          mid,
          insId: chosenClass.x.id,
          eqType: GROUND_EQ_TYPE,
          s: nm, mis: d.mis, h: GROUND_DURATION_H, ss: '1/1',
          r: GROUND_REG, ins: chosenClass.x.nm, lv: chosenClass.x.lv,
          stuKg: stu.kg || 0,
          insKg: chosenClass.x.kg || 0,
          limKg: 0,
          kg: 0,
          baseTag,
          tag: baseTag,
          status: (state.fStatus && state.fStatus[fKey]) || 'Confirmado'
        });
      } else {
        let why;
        if (!state.ins.some(x => x.on && x.lv >= reqLv)) {
          why = `nenhum instrutor ativo disponível para ministrar ${d.mis}`;
        } else if (!starts.length) {
          why = `nenhuma janela diurna habilitada comporta 01h30 de Ground até ${hm(endMax)}`;
        } else {
          const key = Object.keys(fcGnd).sort((a, b) => fcGnd[b] - fcGnd[a])[0];
          why = {
            stu_busy: `conflito de horário com outra missão do próprio aluno (${nm})`,
            sala: `a sala de Ground já está ocupada por outra turma nos horários testados`,
            disp: `nenhum instrutor disponível durante todo o período de 01h30`,
            busy: `todos os instrutores disponíveis já estão ocupados nos horários testados`,
            bloq: `os instrutores disponíveis no horário estão bloqueados por este aluno`
          }[key];
        }
        al.push({ t: 'err', s: labelStu, m: `Rejeitado: ${why}.` });
      }
      continue;
    }

    // ========================================================================
    // RAMO B: ALOCAÇÃO DE MISSÕES DE VOO E SIMULADOR
    // ========================================================================
    const lim = DEFAULT_LIM[d.eq] || 0;
    const H = Math.max(1, Math.round(+d.nb || 1)), K = Math.min(Math.max(+d.ss || 1, 1), H);
    const night = d.mis === 'Noturno';
    const isParafuso = d.mis === 'Parafuso';
    const reqLv = reqInsLevel(d.mis, d.eq);

    // 1. Validação de equipamento permitido para a missão
    if (!m.eq.includes(d.eq)) {
      al.push({
        t: 'err',
        s: labelStu,
        m: `Rejeitado: a missão “${d.mis}” é realizada apenas em ${m.eq.join(' ou ')} (selecionado: ${d.eq}).`
      });
      continue;
    }

    // 2. Validação de Precedência de Ground School (Ground deve ocorrer antes do 1º voo da temática)
    const gatingGrounds = (stuGroundStatus[stuId] || []).filter(g => doesGroundGateFlight(g.mis, d));
    const unallocatedGround = gatingGrounds.find(g => g.allocatedEnd === null);
    if (unallocatedGround) {
      al.push({
        t: 'err',
        s: labelStu,
        m: `Rejeitado: o pré-requisito “${unallocatedGround.mis}” agendado para hoje não pôde ser alocado antes deste voo.`
      });
      continue;
    }
    const minStartAfterGround = gatingGrounds.reduce((maxEnd, g) => Math.max(maxEnd, g.allocatedEnd || 0), 0);

    const starts = (night ? NIGHT_OK : DAY).filter(w => state.win[w]);
    const endMax = night ? 1440 : T[NI];
    const pf = [+d.p1, +d.p2];
    const len = Array.from({ length: K }, (_, j) => (Math.floor(H / K) + (j < H % K ? 1 : 0)) * 60);
    const plans = [];

    (function rec(j, from, pl) {
      if (j === K) { plans.push(pl); return; }
      const c = [...new Set([...(j < 2 ? [pf[j]] : []), ...(j == 0 ? [pf[1]] : []), ...starts])]
        .filter(w => starts.includes(w) && T[w] >= from && T[w] + len[j] <= endMax);
      for (const w of c) rec(j + 1, T[w] + len[j], [...pl, { w, a: T[w], b: T[w] + len[j] }]);
    })(0, minStartAfterGround, []);

    // Filtra a frota candidata respeitando a exclusividade do C152 PR-JPL (Acrobat) para Parafuso
    const fleetPool = (EQ[d.eq] || []).filter(r => {
      if (isParafuso && d.eq === 'C152') return r === ACROBAT_REG;
      return r !== ACROBAT_REG;
    });

    const fc = { stu_busy: 0, eq: 0, disp: 0, busy: 0, bloq: 0, peso: 0 };
    let ch = null;

    for (const pl of plans) {
      const pick = [];
      let prev = stuLastPick[stuId] || null, bad = null;

      for (const p of pl) {
        if (!free(stuBusy, stuId, p.a, p.b)) { bad = 'stu_busy'; break; }

        const eqs = fleetPool.filter(r => state.av[r] && free(used, r, p.a, p.b));
        if (!eqs.length) { bad = 'eq'; break; }

        const q = state.ins.filter(x => x.on && x.lv >= reqLv && cover(x.aw, p.a, p.b));
        if (!q.length) { bad = 'disp'; break; }

        const f1 = q.filter(x => free(busy, x.id, p.a, p.b));
        if (!f1.length) { bad = 'busy'; break; }

        const f2 = f1.filter(x => !stu.bl.includes(x.id));
        if (!f2.length) { bad = 'bloq'; break; }

        const ins = f2.filter(x => !lim || !stu.kg || !x.kg || stu.kg + x.kg <= lim);
        if (!ins.length) { bad = 'peso'; break; }

        ins.sort((a, b) => (prev && (a.id === prev.x.id) - (b.id === prev.x.id)) || a.lv - b.lv || (load[a.id] || 0) - (load[b.id] || 0));

        // O instrutor fica no mesmo avião durante o dia: primeiro o avião que ele já usou hoje,
        // depois o rodízio do aluno (evita o avião anterior dele) e o avião menos usado
        const x = ins[0];
        const ordemNoInstrutor = r => { const i = (insAircraft[x.id] || []).indexOf(r); return i < 0 ? Infinity : i; };
        eqs.sort((a, b) => (ordemNoInstrutor(a) - ordemNoInstrutor(b)) || (prev && (a === prev.r) - (b === prev.r)) || (eu[a] || 0) - (eu[b] || 0));

        prev = { r: eqs[0], x };
        pick.push(prev);
      }

      if (bad) { fc[bad]++; continue; }
      ch = { pl, pick };
      break;
    }

    if (ch) {
      const { pl, pick } = ch;
      let warned = false;
      pl.forEach((p, j) => {
        const { r, x } = pick[j], hh = len[j] / 60;
        (used[r] = used[r] || []).push([p.a, p.b]);
        (busy[x.id] = busy[x.id] || []).push([p.a, p.b]);
        (stuBusy[stuId] = stuBusy[stuId] || []).push([p.a, p.b]);
        stuLastPick[stuId] = { r, x };
        const avioesDoInstrutor = (insAircraft[x.id] = insAircraft[x.id] || []);
        if (!avioesDoInstrutor.includes(r)) avioesDoInstrutor.push(r);

        const fKey = `${stuId}_${mid}_${j + 1}`;
        const baseTag = p.w == d.p1 ? 'Pref. 1' : p.w == d.p2 ? 'Pref. 2' : 'Próximo livre';
        out.push({
          fKey,
          classKey: fKey,
          isGround: false,
          w: p.w, a: p.a, b: p.b,
          o: stuOrder,
          stuId,
          mid,
          insId: x.id,
          eqType: d.eq,
          s: nm, mis: d.mis, h: hh, ss: `${j + 1}/${K}`,
          r, ins: x.nm, lv: x.lv,
          stuKg: stu.kg || 0,
          insKg: x.kg || 0,
          limKg: lim,
          kg: stu.kg && x.kg ? stu.kg + x.kg : 0,
          baseTag,
          tag: baseTag,
          status: (state.fStatus && state.fStatus[fKey]) || 'Confirmado'
        });

        eu[r] = (eu[r] || 0) + hh;
        load[x.id] = (load[x.id] || 0) + hh;

        if (lim && !warned && (!stu.kg || !x.kg)) {
          warned = true;
          al.push({ t: 'warn', s: labelStu, m: `Peso do aluno não informado (0 kg): verificação de limite (${lim} kg) no ${d.eq} não realizada.` });
        }
      });
    } else {
      let why;
      if (isParafuso && d.eq === 'C152' && !state.av[ACROBAT_REG]) {
        why = `a aeronave acrobática ${ACROBAT_REG} (exclusiva para Parafuso no C152) está indisponível/em manutenção`;
      } else if (!fleetPool.some(r => state.av[r])) {
        why = `nenhum equipamento ${d.eq} compatível disponível (manutenção/indisponível)`;
      } else if (!state.ins.some(x => x.on && x.lv >= reqLv)) {
        why = `nenhum instrutor ativo com nível ${A(reqLv)} ou superior (exigido para ${d.mis} em ${d.eq})`;
      } else if (!plans.length) {
        why = minStartAfterGround > 0
          ? `não há janela disponível após o término do Ground School (${hm(minStartAfterGround)}) para encaixar ${H} h antes das ${hm(endMax)}`
          : `não há como encaixar ${H} h${K > 1 ? ' em ' + K + ' sessões' : ' contínuas'} ${night ? 'a partir da janela noturna (17:30)' : 'dentro do horário diurno (término até ' + hm(T[NI]) + ')'} com as janelas habilitadas`;
      } else {
        const key = Object.keys(fc).sort((a, b) => fc[b] - fc[a])[0];
        why = {
          stu_busy: `conflito de horário com outra missão/Ground do próprio aluno (${nm}) já agendada neste dia`,
          eq: isParafuso && d.eq === 'C152'
            ? `a aeronave acrobática ${ACROBAT_REG} (exclusiva para Parafuso) já está ocupada nos horários testados`
            : `falta de ${d.eq} livre nos horários testados (ocupado por voos de maior prioridade)`,
          disp: `nenhum instrutor ${A(reqLv)}+ disponível durante todo o voo nos horários testados`,
          busy: `instrutores ${A(reqLv)}+ já ocupados em algum trecho do voo (conflito de horário)`,
          bloq: `os instrutores ${A(reqLv)}+ livres estão bloqueados por este aluno`,
          peso: `peso aluno + instrutor acima do limite de ${lim} kg do ${d.eq}`
        }[key];
      }
      al.push({ t: 'err', s: labelStu, m: `Rejeitado: ${why}.` });
    }
  }

  // Atualiza a tag das turmas coletivas de Ground com a quantidade de alunos na mesma sala/horário
  const classCounts = {};
  out.forEach(o => {
    if (o.isGround && o.classKey) {
      classCounts[o.classKey] = (classCounts[o.classKey] || 0) + 1;
    }
  });
  out.forEach(o => {
    if (o.isGround && o.classKey) {
      const c = classCounts[o.classKey] || 1;
      o.groupSize = c;
      o.tag = c > 1 ? `${o.baseTag} · Turma (${c})` : o.baseTag;
    }
  });

  out.sort((a, b) => a.a - b.a || (b.isGround ? 1 : 0) - (a.isGround ? 1 : 0) || a.o - b.o);
  return { out, al, tot: act.length };
}

// Calcula horas operacionais deduplicando turmas coletivas de Ground School
export function sumUniqueOperationalHours(flights, statusLookupFn) {
  const seenClasses = new Set();
  let total = 0;
  flights.forEach(o => {
    const st = statusLookupFn ? statusLookupFn(o) : (o.status || 'Confirmado');
    if (st === 'Cancelado') return;
    const key = o.classKey || o.fKey || `${o.w}_${o.a}_${o.b}_${o.mis}_${o.ins}`;
    if (o.isGround || isGroundMission(o.mis)) {
      if (seenClasses.has(key)) return;
      seenClasses.add(key);
    }
    total += (+o.h || 0);
  });
  return Math.round(total * 10) / 10;
}

/**
 * Agrupa voos para o Mapa Visual de Ocupação:
 * - Turmas coletivas de Ground School no mesmo horário/instrutor são consolidadas em uma única barra visual,
 *   evitando sobreposição de barras e contabilizando 1,5 h uma única vez para o instrutor/sala.
 */
export function consolidateTimelineSlots(flights) {
  const slots = [];
  const groundMap = new Map();

  flights.forEach(o => {
    if (o.isGround || isGroundMission(o.mis)) {
      const k = o.classKey || `GND_${o.mis}_${o.w}_${o.ins}`;
      if (!groundMap.has(k)) {
        const clone = { ...o, students: [o.s], items: [o] };
        groundMap.set(k, clone);
        slots.push(clone);
      } else {
        const g = groundMap.get(k);
        g.students.push(o.s);
        g.items.push(o);
      }
    } else {
      slots.push({ ...o, students: [o.s], items: [o] });
    }
  });

  return slots;
}
