// Abas Instrutores e Alunos. Os instrutores têm duas visões: a disponibilidade do dia (uma grade com as janelas e os
// voos de cada um na escala) e o cadastro (nome, peso e habilitações, editadas num painel lateral).
import { WIN, PRE, T } from '../config.js';
import { HABILITACOES, nomeDaHabilitacao } from '../habilitacoes.js';
import { esc } from '../format.js';
import { S, RES, insBy } from '../state.js';
import { $ } from '../dom.js';

const ROTULO = new Map(HABILITACOES.map(h => [h.id, h.curto]));
// No cadastro, todas na ordem do painel; na grade do dia, só as que mais distinguem o instrutor
const ORDEM_DA_GRADE = ['checador_mlte', 'checador_ifr', 'checador_vfr', 'mlte', 'c172', 'ifr', 'noturno', 'parafuso', 'solo',
  'navegacao', 'local', 'tgl', 'sim_multi', 'sim_mono', 'ground_pa34', 'grounds'];
const resumoDasHabilitacoes = x => x.hab.map(h => ROTULO.get(h)).join(' · ');
function resumoNaGrade(x) {
  const rotulos = ORDEM_DA_GRADE.filter(h => x.hab.includes(h)).map(h => ROTULO.get(h));
  return rotulos.length > 3 ? `${rotulos.slice(0, 3).join(' · ')} · +${rotulos.length - 3}` : rotulos.join(' · ');
}
export const GRUPOS_DE_HABILITACAO = [
  ['Ground e simulador', ['grounds', 'ground_pa34', 'sim_mono', 'sim_multi']],
  ['Voo', ['tgl', 'local', 'navegacao', 'solo', 'parafuso', 'ifr', 'noturno']],
  ['Aviões', ['c172', 'mlte']],
  ['Checador', ['checador_vfr', 'checador_ifr', 'checador_mlte']]
];

let vistaDosInstrutores = 'dia';
export function mostrarVistaDosInstrutores(vista) {
  vistaDosInstrutores = vista;
  $('#s-ins').dataset.vista = vista;
  document.querySelectorAll('#s-ins [data-vista-ins]').forEach(b => b.classList.toggle('on', b.dataset.vistaIns === vista));
}

// Voos e aulas de cada instrutor na escala da data (a turma de Ground conta uma vez) e as janelas em que ele está ocupado
function ocupacaoDosInstrutores() {
  const porInstrutor = new Map();
  ((RES && RES.out) || []).forEach(o => {
    const atual = porInstrutor.get(o.insId) || { voos: new Set(), janelas: new Set() };
    atual.voos.add(o.classKey || o.fKey);
    WIN.forEach((_, i) => {
      const inicio = T[i], fim = i < WIN.length - 1 ? T[i + 1] : 24 * 60;
      if (o.a < fim && o.b > inicio) atual.janelas.add(i);
    });
    porInstrutor.set(o.insId, atual);
  });
  return porInstrutor;
}

const atributos = x => `data-k="i" data-id="${x.id}" data-hab="${x.hab.join(' ')}" data-nm="${esc(x.nm.toLowerCase())}"`;
const SEM_INSTRUTORES = 'Nenhum instrutor cadastrado. Clique em “+ Novo instrutor” acima para cadastrar.';

function linhaDoDia(x, ocupacao) {
  const { voos, janelas } = ocupacao.get(x.id) || { voos: new Set(), janelas: new Set() };
  const celulas = WIN.map((w, i) => {
    const cls = `cel${x.aw[i] ? ' on' : ''}${janelas.has(i) ? ' voo' : ''}`;
    return `<td class="jan"><label class="${cls}" title="${w}"><input type="checkbox" data-f="aw" data-w="${i}"${x.aw[i] ? ' checked' : ''} aria-label="${esc(x.nm)} às ${w}"></label></td>`;
  }).join('');
  return `<tr ${atributos(x)}${x.on ? '' : ' class="off"'}>
    <td class="nome"><b>${esc(x.nm)}</b></td>
    <td><input type="checkbox" class="sw" data-f="on"${x.on ? ' checked' : ''} aria-label="${esc(x.nm)} vem no dia"></td>
    ${celulas}
    <td class="voos">${voos.size || ''}</td>
    <td><select data-f="pre" class="edit-only" aria-label="Aplicar um turno a ${esc(x.nm)}"><option value="">Aplicar turno…</option>${Object.keys(PRE).map(k => `<option>${k}</option>`).join('')}</select></td>
    <td class="habs-resumo" title="${esc(resumoDasHabilitacoes(x))}">${esc(resumoNaGrade(x))}</td>
  </tr>`;
}

export function linhaDoCadastro(x) {
  return `<tr class="cd" ${atributos(x)}>
    <td><input class="nm" data-f="nm" value="${esc(x.nm)}" aria-label="Nome do instrutor"></td>
    <td><input type="number" min="0" max="200" data-f="kg" value="${x.kg || ''}" placeholder="sem peso" aria-label="Peso de ${esc(x.nm)} em kg"${x.kg ? '' : ' class="falta"'}></td>
    <td><span class="habs-resumo">${esc(resumoDasHabilitacoes(x)) || 'Nenhuma'}</span></td>
    <td class="acoes"><button class="btn quiet edit-only" data-act="editar-habs" data-id="${x.id}">Editar habilitações</button><button class="x edit-only" data-act="deli" aria-label="Excluir ${esc(x.nm)}">✕</button></td>
  </tr>`;
}

// A grade do dia depende da escala: é refeita junto com ela
export function rInsDia() {
  $('#inst-dia-cab').innerHTML = `<tr><th>Instrutor</th><th>Hoje</th>${WIN.map(w => `<th class="jan">${w}</th>`).join('')}<th>Voos</th><th>Turno</th><th>Habilitações</th></tr>`;
  if (!S.ins.length) {
    $('#inst-dia').innerHTML = `<tr><td colspan="${WIN.length + 5}" class="h">${SEM_INSTRUTORES}</td></tr>`;
    return;
  }
  const ocupacao = ocupacaoDosInstrutores();
  // Quem usa o teclado continua no mesmo campo depois que a grade é refeita
  const foco = $('#inst-dia').contains(document.activeElement) ? seletorDoCampo(document.activeElement) : null;
  $('#inst-dia').innerHTML = S.ins.map(x => linhaDoDia(x, ocupacao)).join('');
  if (foco && $('#inst-dia').querySelector(foco)) $('#inst-dia').querySelector(foco).focus();
  applyInstructorFilters();
}

function seletorDoCampo(el) {
  const linha = el.closest('tr[data-id]');
  const campo = ['data-f', 'data-w'].filter(a => el.hasAttribute(a)).map(a => `[${a}="${el.getAttribute(a)}"]`).join('');
  return linha && campo ? `tr[data-id="${linha.dataset.id}"] ${campo}` : null;
}

// Atualiza a linha do cadastro no lugar, sem trocar os campos (o foco de quem usa o teclado continua onde estava)
export function atualizarLinhaDoCadastro(x) {
  const linha = document.querySelector(`#inst tr.cd[data-id="${x.id}"]`);
  if (!linha) return;
  linha.dataset.hab = x.hab.join(' ');
  linha.dataset.nm = x.nm.toLowerCase();
  linha.querySelector('[data-f="nm"]').value = x.nm;
  const kg = linha.querySelector('[data-f="kg"]');
  kg.value = x.kg || '';
  kg.classList.toggle('falta', !x.kg);
  kg.setAttribute('aria-label', `Peso de ${x.nm} em kg`);
  linha.querySelector('[data-act="deli"]').setAttribute('aria-label', `Excluir ${x.nm}`);
  linha.querySelector('.habs-resumo').textContent = resumoDasHabilitacoes(x) || 'Nenhuma';
  const titulo = $('#painel-instrutor-titulo');
  if (titulo && !$('#painel-instrutor').hidden && +$('#painel-instrutor').dataset.id === x.id) titulo.querySelector('small').textContent = x.nm;
  applyInstructorFilters();
}

export function rIns() {
  mostrarVistaDosInstrutores(vistaDosInstrutores);
  $('#inst').innerHTML = S.ins.length ? S.ins.map(linhaDoCadastro).join('') : `<tr><td colspan="4" class="h">${SEM_INSTRUTORES}</td></tr>`;
  rInsDia();
  rPainelDoInstrutor();
}

// Painel lateral com as habilitações de um instrutor, em grupos
export function rPainelDoInstrutor() {
  const painel = $('#painel-instrutor');
  if (!painel || painel.hidden) return;
  const x = insBy(+painel.dataset.id);
  if (!x) { painel.hidden = true; return; }
  painel.innerHTML = `<div class="gaveta-cab">
      <h2 id="painel-instrutor-titulo">Habilitações <small>${esc(x.nm)}</small></h2>
      <button class="x" type="button" id="btn-fechar-painel-instrutor" aria-label="Fechar o painel">✕</button>
    </div>
    <p class="h">Marque o que o instrutor pode fazer. No C172 e no PA-34, a missão exige também a habilitação do avião.</p>
    <div class="habs-painel" data-k="i" data-id="${x.id}">
      ${GRUPOS_DE_HABILITACAO.map(([titulo, ids]) => `<fieldset><legend>${titulo}</legend>${ids.map(h =>
        `<label class="hab"><input type="checkbox" class="sw" data-f="hab" data-h="${h}"${x.hab.includes(h) ? ' checked' : ''}>${esc(nomeDaHabilitacao(h))}</label>`).join('')}</fieldset>`).join('')}
    </div>`;
}

export function abrirPainelDoInstrutor(id) {
  const painel = $('#painel-instrutor');
  painel.dataset.id = id;
  painel.hidden = false;
  rPainelDoInstrutor();
  $('#btn-fechar-painel-instrutor').focus();
}

export function fecharPainelDoInstrutor(devolverFoco = false) {
  const painel = $('#painel-instrutor');
  painel.hidden = true;
  const botao = document.querySelector(`#inst tr.cd[data-id="${painel.dataset.id}"] [data-act="editar-habs"]`);
  if (devolverFoco && botao) botao.focus();
}

// Alunos: uma tabela (nome, peso e os instrutores com quem o aluno não deve ser escalado)
function naoEscalarCom(s) {
  return s.bl.map(b => insBy(b) ? `<span class="tg">${esc(insBy(b).nm)}<button class="edit-only" data-act="unbl" data-b="${b}" aria-label="Voltar a escalar com ${esc(insBy(b).nm)}">✕</button></span>` : '').join('') +
    `<select data-f="bl" class="edit-only" aria-label="Não escalar com"><option value="">Não escalar com…</option>${S.ins.filter(x => !s.bl.includes(x.id)).map(x => `<option value="${x.id}">${esc(x.nm)}</option>`).join('')}</select>`;
}

const linhaDoAluno = s => `<tr class="cd" data-k="s" data-id="${s.id}" data-nm="${esc(s.nm.toLowerCase())}">
  <td><input class="nm" data-f="nm" value="${esc(s.nm)}" aria-label="Nome do aluno"></td>
  <td><input type="number" min="0" max="200" data-f="kg" value="${s.kg || ''}" placeholder="sem peso" aria-label="Peso de ${esc(s.nm)} em kg"${s.kg ? '' : ' class="falta"'}></td>
  <td><div class="bl">${naoEscalarCom(s)}</div></td>
  <td class="acoes"><button class="x edit-only" data-act="dels" aria-label="Excluir ${esc(s.nm)}">✕</button></td>
</tr>`;

export const rAlu = () => {
  $('#alu').innerHTML = S.stu.length ? S.stu.map(linhaDoAluno).join('')
    : '<tr><td colspan="4" class="h">Nenhum aluno cadastrado. Clique em “+ Novo aluno” acima para cadastrar.</td></tr>';
};

// Atualiza a linha do aluno no lugar. "Não escalar com" é refeito só quando muda, e o foco volta para o seletor
export function atualizarLinhaDoAluno(s, { naoEscalar = false } = {}) {
  const linha = document.querySelector(`#alu tr.cd[data-id="${s.id}"]`);
  if (!linha) return;
  linha.dataset.nm = s.nm.toLowerCase();
  linha.querySelector('[data-f="nm"]').value = s.nm;
  const kg = linha.querySelector('[data-f="kg"]');
  kg.value = s.kg || '';
  kg.classList.toggle('falta', !s.kg);
  kg.setAttribute('aria-label', `Peso de ${s.nm} em kg`);
  linha.querySelector('[data-act="dels"]').setAttribute('aria-label', `Excluir ${s.nm}`);
  if (!naoEscalar) return;
  linha.querySelector('.bl').innerHTML = naoEscalarCom(s);
  linha.querySelector('[data-f="bl"]').focus();
}

// Filtro da aba Instrutores: uma opção por habilitação
export function preencherFiltroDeHabilitacoes() {
  $('#flt-ins-hab').insertAdjacentHTML('beforeend', HABILITACOES.map(h => `<option value="${h.id}">${esc(h.nome)}</option>`).join(''));
}

// Os filtros valem para as duas visões
export function applyInstructorFilters() {
  const q = ($('[data-flt="inst"]') && $('[data-flt="inst"]').value || '').toLowerCase();
  const hab = ($('#flt-ins-hab') && $('#flt-ins-hab').value) || '';
  document.querySelectorAll('#inst tr.cd, #inst-dia tr[data-k="i"]').forEach(c => {
    const matchName = !q || c.dataset.nm.includes(q);
    const matchHab = !hab || c.dataset.hab.split(' ').includes(hab);
    c.hidden = !(matchName && matchHab);
  });
}
