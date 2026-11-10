// Navegação entre as abas.
import { rBI } from './bi.js';

export function show(t) {
  document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === 's-' + t));
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'bi') rBI();
}
