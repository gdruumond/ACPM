import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { hm, fmtH, fmtDurLabel, WLB, pad, esc, amanhaISO, isoMenosDias, fimDoMes } from '../../js/format.js';

describe('Formatação', () => {
  it('minutos do dia em HH:MM', () => {
    assert.deepEqual([0, 390, 1050, 1439].map(hm), ['00:00', '06:30', '17:30', '23:59']);
  });

  it('horas com vírgula decimal e arredondamento de uma casa', () => {
    assert.deepEqual([2, 1.5, 1.25, 0, undefined, '3'].map(fmtH), ['2 h', '1,5 h', '1,3 h', '0 h', '0 h', '3 h']);
  });

  it('duração do Ground em 01h30', () => {
    assert.equal(fmtDurLabel(1.5), '01h30 (1,5 h)');
    assert.equal(fmtDurLabel(2), '2 h');
  });

  it('rótulo da janela de instrução', () => {
    assert.equal(WLB(0), '06:30 · 1º tempo');
    assert.equal(WLB(8), '17:30 · 9º tempo (noturno)');
  });

  it('nome padrão do aluno', () => {
    assert.equal(pad(0), 'Aluno 01');
    assert.equal(pad(19), 'Aluno 20');
  });

  it('escapa HTML', () => {
    assert.equal(esc('<b title="x">Ana & Bia</b>'), '&lt;b title=&quot;x&quot;&gt;Ana &amp; Bia&lt;/b&gt;');
    assert.equal(esc(42), '42');
  });

  it('datas AAAA-MM-DD: amanhã, dias antes e fim do mês (com virada de mês, ano e bissexto)', () => {
    mock.timers.enable({ apis: ['Date'], now: new Date('2026-12-31T15:00:00Z') });
    try { assert.equal(amanhaISO(), '2027-01-01'); } finally { mock.timers.reset(); }
    assert.equal(isoMenosDias('2026-11-11', 6), '2026-11-05');
    assert.equal(isoMenosDias('2026-03-02', 2), '2026-02-28');
    assert.equal(isoMenosDias('2027-01-01', 1), '2026-12-31');
    assert.deepEqual(['2026-11-11', '2026-12-01', '2026-02-10', '2028-02-10'].map(fimDoMes), ['2026-11-30', '2026-12-31', '2026-02-28', '2028-02-29']);
  });
});
