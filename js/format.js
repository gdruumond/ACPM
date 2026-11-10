// Formatação de horários, durações, níveis e textos exibidos na interface, no CSV e no PDF.
import { WIN, NI } from './config.js';

export const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const WLB = i => `${WIN[i]} · ${i + 1}º tempo` + (i == NI ? ' (noturno)' : '');

// Formatação limpa de horas (suporta 1.5 h = 01h30 do Ground School e horas inteiras de voo)
export const fmtH = v => {
  const n = Math.round((+v || 0) * 10) / 10;
  return Number.isInteger(n) ? `${n} h` : `${String(n).replace('.', ',')} h`;
};
export const fmtDurLabel = h => (+h === 1.5 ? '01h30 (1,5 h)' : `${h} h`);

export const pad = i => 'Aluno ' + String(i + 1).padStart(2, '0');
export const A = n => 'A0' + n;

// Datas no formato AAAA-MM-DD
export const amanhaISO = () => {
  const t = new Date(Date.now() + 864e5);
  return new Date(t - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
};
export const isoMenosDias = (iso, dias) => new Date(Date.parse(iso + 'T12:00:00Z') - dias * 864e5).toISOString().slice(0, 10);
export const fimDoMes = iso => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7), 0)).toISOString().slice(0, 10);

export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const opts = (a, sel) => a.map(([v, l]) => `<option value="${v}"${String(v) === String(sel) ? ' selected' : ''}>${l}</option>`).join('');
export const wopt = (sel, none) => opts([...(none ? [[-1, '—']] : []), ...WIN.map((w, i) => [i, w + (i == NI ? ' (noturno)' : '')])], sel);
