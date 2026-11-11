// Utilitários de DOM: seletor, avisos (notificação temporária e aviso fixo) e foco no último campo.

export const $ = s => document.querySelector(s);

export function showToast(text) {
  const box = $('#toast-box');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  box.appendChild(el);
  setTimeout(() => { el.remove(); }, 2800);
}

// Aviso fixo no topo, com o botão "Recarregar". O conflito e a falha ao preparar os dados só saem recarregando;
// o erro de gravação some quando uma gravação der certo (fecharAviso('erro'))
let avisoAtual = null;
export const avisoAberto = () => avisoAtual;
export function mostrarAviso(tipo, texto) {
  avisoAtual = tipo;
  $('#aviso-sync-texto').textContent = texto;
  $('#aviso-sync').hidden = false;
  $('#btn-recarregar').onclick = () => window.location.reload();
}
export function fecharAviso(tipo) {
  if (avisoAtual !== tipo) return;
  avisoAtual = null;
  $('#aviso-sync').hidden = true;
}

export const focusLast = sel => {
  const e = [...document.querySelectorAll(sel)].pop();
  if (e) { e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); }
};
