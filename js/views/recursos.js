// Aba 1 · Recursos: janelas de operação, frota (manutenção) e revisão de 50 horas dos aviões.
import { WIN, NI, EQ, ACROBAT_REG, EQT, AIRCRAFT_EQ_TYPES, REVISAO_H } from '../config.js';
import { S, RES } from '../state.js';
import { $ } from '../dom.js';
import { hm, fmtH } from '../format.js';

// Horas de cada avião desde a última revisão (no início da data aberta), o saldo e onde ele para na escala do dia
export function rRevisao() {
  const resumo = (RES && RES.revisao) || {};
  const linhas = AIRCRAFT_EQ_TYPES.flatMap(tipo => EQ[tipo].map(r => {
    const horas = S.horas[r];
    const temHoras = typeof horas === 'number';
    const naEscala = resumo[r];
    const situacao = !temHoras ? '<span class="h">—</span>'
      : naEscala && naEscala.paraAs !== null
        ? `<span class="tag er">Parou para revisão de 50 horas ${naEscala.voadas ? 'às ' + hm(naEscala.paraAs) : '(sem saldo hoje)'}</span>`
        : naEscala ? `${fmtH(naEscala.voadas)} na escala · termina o dia com ${fmtH(naEscala.fim)}` : '—';
    return `<tr data-r="${r}">
      <td><b>${r}</b> <span class="sm">${tipo}</span></td>
      <td><input type="number" min="0" max="60" step="0.1" inputmode="decimal" data-a="horas" data-id="${r}" value="${temHoras ? horas : ''}" placeholder="—" aria-label="Horas do ${r} desde a última revisão"></td>
      <td>${temHoras ? fmtH(Math.max(0, REVISAO_H - horas)) : '—'}</td>
      <td>${situacao}</td>
      <td><button class="x edit-only" data-act="revisao" data-id="${r}">Revisão feita</button></td>
    </tr>`;
  }));
  $('#revisao').innerHTML = `<h2>Revisão de 50 horas</h2><div class="pn">
    <p class="h">Horas de voo de cada avião desde a última revisão, no início desta data. A escala não passa das 50 horas: o avião para quando não tem saldo para mais um voo. A data seguinte começa com estas horas mais os voos do dia que não foram cancelados. Avião sem as horas informadas fica sem esse controle.</p>
    <div class="tw"><table class="revisao">
      <thead><tr><th>Avião</th><th>Horas desde a revisão</th><th>Saldo até 50 h</th><th>Escala do dia</th><th></th></tr></thead>
      <tbody>${linhas.join('')}</tbody>
    </table></div>
  </div>`;
}

export function rRec() {
  $('#wins').innerHTML = WIN.map((w, i) =>
    `<label class="chip${S.win[i] ? '' : ' off'}"><input type="checkbox" data-a="win" data-i="${i}"${S.win[i] ? ' checked' : ''}>${i + 1}º · ${w}${i == NI ? ' (noturno)' : ''}</label>`
  ).join('');

  $('#eqs').innerHTML = Object.keys(EQ).map(k =>
    `<h2>${EQT[k]}</h2><div class="pn"><div class="chips">${
      EQ[k].map(r => {
        const badge = r === ACROBAT_REG ? ' <span class="chip-sub" title="Exclusivo para a missão de Parafuso">Acrobat · Parafuso</span>' : '';
        return `<label class="chip${S.av[r] ? '' : ' off'}"><input type="checkbox" data-a="av" data-id="${r}"${S.av[r] ? ' checked' : ''}>${r}${badge}</label>`;
      }).join('')
    }</div></div>`
  ).join('');
  rRevisao();
}
