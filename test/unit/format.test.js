import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hm, fmtH, fmtDurLabel, WLB, A, pad, esc } from '../../js/format.js';

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

  it('nível do instrutor e nome padrão do aluno', () => {
    assert.equal(A(7), 'A07');
    assert.equal(pad(0), 'Aluno 01');
    assert.equal(pad(19), 'Aluno 20');
  });

  it('escapa HTML', () => {
    assert.equal(esc('<b title="x">Ana & Bia</b>'), '&lt;b title=&quot;x&quot;&gt;Ana &amp; Bia&lt;/b&gt;');
    assert.equal(esc(42), '42');
  });
});
