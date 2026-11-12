// Aba Recursos: janelas de operação e a frota numa tabela só: disponível ou em manutenção, horas desde a última
// revisão de 50 horas, saldo até a revisão e o que o avião voa na escala do dia. A tabela mostra uma categoria ou
// todas, e cada categoria recolhe e abre.
import { WIN, NI, EQ, ACROBAT_REG, AIRCRAFT_EQ_TYPES, SIM_EQ_TYPES, REVISAO_H } from '../config.js';
import { S, RES } from '../state.js';
import { $ } from '../dom.js';
import { hm, fmtH } from '../format.js';

// Os grupos usam os ids das categorias do filtro (js/categorias.js)
const GRUPOS = [...AIRCRAFT_EQ_TYPES.map(tipo => ({ id: tipo, rotulo: tipo, tipos: [tipo] })), { id: 'sim', rotulo: 'Simuladores', tipos: SIM_EQ_TYPES }];

// Categorias recolhidas (continuam assim quando a escala é refeita, até recarregar a página)
const recolhidos = new Set();
export function alternarGrupoDaFrota(id) {
  const recolher = !recolhidos.has(id);
  if (recolher) recolhidos.add(id);
  else recolhidos.delete(id);
  document.querySelectorAll(`#revisao tr[data-r][data-grupo="${id}"]`).forEach(tr => { tr.hidden = recolher; });
  const botao = document.querySelector(`#revisao [data-recolher-grupo="${id}"]`);
  if (botao) botao.setAttribute('aria-expanded', String(!recolher));
}

function situacao(r, voadas, revisao) {
  if (!S.av[r]) return '<span class="tag">Em manutenção</span>';
  if (revisao && revisao.paraAs !== null) {
    return `<span class="tag er">Parou para revisão de 50 horas ${revisao.voadas ? 'às ' + hm(revisao.paraAs) : '(sem saldo hoje)'}</span>`;
  }
  if (!voadas) return '<span class="sm">—</span>';
  return `${fmtH(voadas)} na escala${revisao ? ` · termina com ${fmtH(revisao.fim)}` : ''}`;
}

// Saldo até a revisão, com uma barra: âmbar abaixo de 10 h e vermelha abaixo de 5 h
function saldo(horas) {
  const resta = Math.max(0, REVISAO_H - horas);
  const cor = resta < 5 ? 'er' : resta < 10 ? 'wa' : '';
  const largura = Math.max(2, Math.min(100, (resta / REVISAO_H) * 100)).toFixed(0);
  return `<span class="saldo">${fmtH(resta)}</span><span class="barra ${cor}"><i style="width:${largura}%"></i></span>`;
}

function linha(r, tipo, grupo, voadas, revisao) {
  const aviao = AIRCRAFT_EQ_TYPES.includes(tipo);
  const horas = S.horas[r];
  const temHoras = typeof horas === 'number';
  const parafuso = r === ACROBAT_REG ? ' <span class="tag fb" title="Exclusivo para a missão de Parafuso">Só Parafuso</span>' : '';
  return `<tr data-r="${r}" data-grupo="${grupo}"${S.av[r] ? '' : ' class="manutencao"'}${recolhidos.has(grupo) ? ' hidden' : ''}>
    <td><label class="alvo"><input type="checkbox" class="sw" data-a="av" data-id="${r}"${S.av[r] ? ' checked' : ''} aria-label="${r} disponível"></label></td>
    <td><b>${r}</b>${aviao ? '' : ` <small class="sm">${tipo}</small>`}${parafuso}</td>
    <td>${aviao ? `<input type="number" class="horas" min="0" max="60" step="0.1" inputmode="decimal" data-a="horas" data-horas="${r}" value="${temHoras ? horas : ''}" placeholder="—" aria-label="Horas do ${r} desde a última revisão"> h` : ''}</td>
    <td>${aviao && temHoras ? saldo(horas) : ''}</td>
    <td>${situacao(r, voadas, revisao)}</td>
    <td class="edit-only">${aviao ? `<button class="btn quiet rev" data-act="revisao" data-id="${r}">Revisão feita</button>` : ''}</td>
  </tr>`;
}

// A frota, por tipo: refeita junto com a escala (as horas voadas no dia e onde cada avião para)
export function rRevisao() {
  const resumo = (RES && RES.revisao) || {};
  const voadas = {};
  ((RES && RES.out) || []).forEach(o => { voadas[o.r] = (voadas[o.r] || 0) + o.h; });
  const categoria = ($('#flt-rec-cat') && $('#flt-rec-cat').value) || '';
  $('#revisao').innerHTML = GRUPOS.filter(g => !categoria || g.id === categoria).map(({ id, rotulo, tipos }) => {
    const regs = tipos.flatMap(tipo => EQ[tipo].map(r => [r, tipo]));
    const disponiveis = regs.filter(([r]) => S.av[r]).length;
    return `<tr class="grupo"><td colspan="6"><button type="button" class="grupo-btn" data-recolher-grupo="${id}" aria-expanded="${!recolhidos.has(id)}"><svg class="ico seta" aria-hidden="true"><use href="#i-baixo"/></svg>${rotulo} <small>${disponiveis} de ${regs.length} disponíveis</small></button></td></tr>` +
      regs.map(([r, tipo]) => linha(r, tipo, id, voadas[r] || 0, resumo[r])).join('');
  }).join('');
}

export function rRec() {
  $('#wins').innerHTML = WIN.map((w, i) => `<label class="janela${S.win[i] ? '' : ' off'}"><input type="checkbox" class="sw" data-a="win" data-i="${i}"${S.win[i] ? ' checked' : ''}><b>${w}</b> <small>${i == NI ? 'noturno' : (i + 1) + 'º'}</small></label>`).join('');
  rRevisao();
}
