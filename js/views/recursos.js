// Aba 1 · Recursos: janelas de operação e frota (manutenção).
import { WIN, NI, EQ, ACROBAT_REG, EQT } from '../config.js';
import { S } from '../state.js';
import { $ } from '../dom.js';

export function rRec() {
  $('#wins').innerHTML = WIN.map((w, i) =>
    `<label class="chip${S.win[i] ? '' : ' off'}"><input type="checkbox" data-a="win" data-i="${i}"${S.win[i] ? ' checked' : ''}>${i + 1}º · ${w}${i == NI ? ' (noturno)' : ''}</label>`
  ).join('');

  $('#eqs').innerHTML = Object.keys(EQ).map(k =>
    `<h2>${EQT[k]}</h2><div class="pn"><div class="chips">${
      EQ[k].map(r => {
        const badge = r === ACROBAT_REG ? ' <span class="chip-sub" title="Exclusivo para missão de Parafuso (A06+)">Acrobat · Parafuso</span>' : '';
        return `<label class="chip${S.av[r] ? '' : ' off'}"><input type="checkbox" data-a="av" data-id="${r}"${S.av[r] ? ' checked' : ''}>${r}${badge}</label>`;
      }).join('')
    }</div></div>`
  ).join('');
}
