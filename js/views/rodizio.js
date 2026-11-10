// Aba 6 · Rodízio: as filas de cada categoria (na data aberta), quem já voa nelas na escala e os botões para ajustar.
import { CATEGORIAS_DO_RODIZIO, categoriaDoRodizio, ajustarFilas } from '../rodizio.js';
import { S, RES } from '../state.js';
import { $ } from '../dom.js';
import { esc } from '../format.js';

export function rRodizio() {
  const filas = ajustarFilas(S.filas, S.ins);
  const voos = (RES && RES.out) || [];
  $('#rodizio').innerHTML = CATEGORIAS_DO_RODIZIO.map(({ id, nome }) => {
    const fila = filas[id];
    const itens = fila.map((insId, i) => {
      const x = S.ins.find(y => y.id === insId);
      const naEscala = voos.filter(o => o.insId === insId && categoriaDoRodizio(o.mis, o.eqType) === id).length;
      return `<li data-id="${insId}">
        <span class="pos">${i + 1}º</span>
        <b>${esc(x.nm)}</b>
        ${naEscala ? `<span class="tag grp">${naEscala} ${naEscala === 1 ? 'voo' : 'voos'} nesta data</span>` : ''}
        ${x.on ? '' : '<span class="tag fb">indisponível</span>'}
        <span class="acoes edit-only">
          <button class="x" data-act="fila-subir" data-cat="${id}" data-id="${insId}" aria-label="Subir ${esc(x.nm)}"${i === 0 ? ' disabled' : ''}>↑</button>
          <button class="x" data-act="fila-descer" data-cat="${id}" data-id="${insId}" aria-label="Descer ${esc(x.nm)}"${i === fila.length - 1 ? ' disabled' : ''}>↓</button>
          <button class="x" data-act="fila-inicio" data-cat="${id}" data-id="${insId}"${i === 0 ? ' disabled' : ''}>Para o início</button>
        </span>
      </li>`;
    }).join('');
    return `<div class="pn" data-cat="${id}"><h3>${esc(nome)}</h3>${fila.length ? `<ol class="fila">${itens}</ol>` : '<p class="h">Nenhum instrutor habilitado.</p>'}</div>`;
  }).join('');
}
