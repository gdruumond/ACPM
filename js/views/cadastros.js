// Abas 2 e 3 · Instrutores e Alunos: cartões de cadastro e filtros.
import { WIN, PRE } from '../config.js';
import { HABILITACOES } from '../habilitacoes.js';
import { esc } from '../format.js';
import { S, insBy } from '../state.js';
import { $ } from '../dom.js';

export const insHTML = x => `<div class="cd${x.on ? '' : ' off'}" data-k="i" data-id="${x.id}" data-hab="${x.hab.join(' ')}" data-nm="${esc(x.nm.toLowerCase())}">
  <div class="r1">
    <input type="checkbox" data-f="on"${x.on ? ' checked' : ''} title="Disponível no dia" aria-label="Disponível">
    <input class="nm" data-f="nm" value="${esc(x.nm)}" aria-label="Nome">
    <button class="x edit-only" data-act="deli" aria-label="Excluir">✕</button>
  </div>
  <div class="r2">
    <input type="number" min="0" max="200" data-f="kg" value="${x.kg || ''}" placeholder="Peso kg" aria-label="Peso em kg">
    <select data-f="pre" class="edit-only" aria-label="Turno rápido"><option value="">Turno rápido…</option>${Object.keys(PRE).map(k => `<option>${k}</option>`).join('')}</select>
  </div>
  <div class="ws">${WIN.map((w, i) => `<label class="w${x.aw[i] ? ' on' : ''}"><input type="checkbox" data-f="aw" data-w="${i}"${x.aw[i] ? ' checked' : ''}>${w}</label>`).join('')}</div>
  <div class="habs" role="group" aria-label="Habilitações de ${esc(x.nm)}"><span class="sm">Habilitações:</span>${HABILITACOES.map(h => {
    const tem = x.hab.includes(h.id);
    return `<label class="w${tem ? ' on' : ''}" title="${esc(h.nome)}"><input type="checkbox" data-f="hab" data-h="${h.id}" aria-label="${esc(h.nome)}"${tem ? ' checked' : ''}>${esc(h.curto)}</label>`;
  }).join('')}</div>
</div>`;

export const stuHTML = s => `<div class="cd" data-k="s" data-id="${s.id}" data-nm="${esc(s.nm.toLowerCase())}">
  <div class="r1">
    <input class="nm" data-f="nm" value="${esc(s.nm)}" aria-label="Nome">
    <input type="number" min="0" max="200" data-f="kg" value="${s.kg || ''}" placeholder="Peso kg" aria-label="Peso em kg">
    <button class="x edit-only" data-act="dels" aria-label="Excluir">✕</button>
  </div>
  <div class="bl">
    ${s.bl.map(b => insBy(b) ? `<span class="tg">${esc(insBy(b).nm)}<button class="edit-only" data-act="unbl" data-b="${b}" aria-label="Remover bloqueio">✕</button></span>` : '').join('')}
    <select data-f="bl" class="edit-only"><option value="">+ Bloquear…</option>${S.ins.filter(x => !s.bl.includes(x.id)).map(x => `<option value="${x.id}">${esc(x.nm)}</option>`).join('')}</select>
  </div>
</div>`;

export const rIns = () => {
  if (!S.ins.length) {
    $('#inst').innerHTML = `<p class="h" style="grid-column:1/-1">Nenhum instrutor cadastrado. Clique em “+ Novo instrutor” acima para cadastrar ou use “Preencher exemplo” na aba 5 · Demanda.</p>`;
    return;
  }
  $('#inst').innerHTML = S.ins.map(insHTML).join('');
};

export const rAlu = () => {
  if (!S.stu.length) {
    $('#alu').innerHTML = `<p class="h" style="grid-column:1/-1">Nenhum aluno cadastrado. Clique em “+ Novo aluno” acima para cadastrar ou use “Preencher exemplo” na aba 5 · Demanda.</p>`;
    return;
  }
  $('#alu').innerHTML = S.stu.map(stuHTML).join('');
};

// Filtro da aba Instrutores: uma opção por habilitação
export function preencherFiltroDeHabilitacoes() {
  $('#flt-ins-hab').insertAdjacentHTML('beforeend', HABILITACOES.map(h => `<option value="${h.id}">${esc(h.nome)}</option>`).join(''));
}

export function applyInstructorFilters() {
  const q = ($('[data-flt="inst"]') && $('[data-flt="inst"]').value || '').toLowerCase();
  const hab = ($('#flt-ins-hab') && $('#flt-ins-hab').value) || '';
  document.querySelectorAll('#inst .cd').forEach(c => {
    const matchName = !q || c.dataset.nm.includes(q);
    const matchHab = !hab || c.dataset.hab.split(' ').includes(hab);
    c.hidden = !(matchName && matchHab);
  });
}
