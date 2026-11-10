// Utilitários de DOM: seletor, avisos (toast), mensagem de status e foco no último campo.

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

export const msg = t => { const el = $('#msg'); if (el) el.textContent = t; if (t) showToast(t); };

export const focusLast = sel => {
  const e = [...document.querySelectorAll(sel)].pop();
  if (e) { e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); }
};
