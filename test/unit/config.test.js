import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WIN, T, NI, DAY, NIGHT_OK, EQ, MIS, DEFAULT_LIM, ACROBAT_REG, ALL_EQ_TYPES, PRE } from '../../js/config.js';

describe('Configuração operacional', () => {
  it('nove janelas de instrução, a última noturna', () => {
    assert.deepEqual(WIN, ['06:30', '08:20', '10:10', '11:30', '12:40', '13:40', '14:30', '16:20', '17:30']);
    assert.deepEqual(T, [390, 500, 610, 690, 760, 820, 870, 980, 1050]);
    assert.equal(NI, 8);
    assert.deepEqual(DAY, [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(NIGHT_OK, [8]);
  });

  it('frota com 26 recursos e o PR-JPL no C152', () => {
    assert.deepEqual(Object.fromEntries(Object.entries(EQ).map(([k, v]) => [k, v.length])),
      { 'Sim. Mono': 2, 'Sim. Multi': 2, 'C152': 13, 'C172': 6, 'PA-34': 3 });
    assert.ok(EQ.C152.includes(ACROBAT_REG));
    assert.deepEqual(ALL_EQ_TYPES, ['Sim. Mono', 'Sim. Multi', 'C152', 'C172', 'PA-34', 'Sala Ground']);
  });

  it('cada missão tem equipamento padrão entre os permitidos', () => {
    assert.equal(Object.keys(MIS).length, 18);
    for (const [nome, m] of Object.entries(MIS)) assert.ok(m.eq.includes(m.defEq), nome);
  });

  it('limites de peso por equipamento', () => {
    assert.deepEqual(DEFAULT_LIM, { 'C152': 170, 'C172': 222, 'PA-34': 250 });
  });

  it('turnos rápidos', () => {
    assert.deepEqual(PRE['Manhã'], [0, 1, 2, 3]);
  });
});
