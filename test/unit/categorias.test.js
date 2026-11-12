// Categorias de recurso dos filtros da Escala e de Recursos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIAS, categoriaDoRecurso, categoriaDoTipo, recursosDaCategoria } from '../../js/categorias.js';
import { FROTA_INICIAL } from '../../js/frota.js';

describe('Categorias de recurso', () => {
  it('na ordem da operação: C152, C172, Simulador, PA-34 e Sala Ground', () => {
    assert.deepEqual(CATEGORIAS.map(c => c.nome), ['C152', 'C172', 'Simulador', 'PA-34', 'Sala Ground']);
  });

  it('a categoria de cada matrícula da frota, dos simuladores e da sala de Ground', () => {
    assert.equal(categoriaDoRecurso('PP-LJV', FROTA_INICIAL), 'C152');
    assert.equal(categoriaDoRecurso('PR-JPL', FROTA_INICIAL), 'C152');
    assert.equal(categoriaDoRecurso('PP-AJS', FROTA_INICIAL), 'C172');
    assert.equal(categoriaDoRecurso('SIM-MONO-A', FROTA_INICIAL), 'sim');
    assert.equal(categoriaDoRecurso('SIM-MLTE-D', FROTA_INICIAL), 'sim');
    assert.equal(categoriaDoRecurso('PT-KIW', FROTA_INICIAL), 'PA-34');
    assert.equal(categoriaDoRecurso('SALA-GROUND', FROTA_INICIAL), 'ground');
    assert.equal(categoriaDoRecurso('XX-XXX', FROTA_INICIAL), null);
    assert.equal(categoriaDoRecurso('PR-NEW', [{ reg: 'PR-NEW', tipo: 'C172' }]), 'C172');
  });

  it('a categoria de um tipo (vale também para um recurso que já saiu da frota)', () => {
    assert.deepEqual(['C152', 'C172', 'PA-34', 'Sim. Mono', 'Sim. Multi', 'Sala Ground', 'Boeing'].map(categoriaDoTipo),
      ['C152', 'C172', 'PA-34', 'sim', 'sim', 'ground', null]);
  });

  it('os recursos de cada categoria, na frota', () => {
    assert.deepEqual(recursosDaCategoria('PA-34', FROTA_INICIAL), ['PR-VOM', 'PT-JOB', 'PT-KIW']);
    assert.deepEqual(recursosDaCategoria('sim', FROTA_INICIAL), ['SIM-MONO-A', 'SIM-MONO-C', 'SIM-MLTE-E', 'SIM-MLTE-D']);
    assert.deepEqual(recursosDaCategoria('ground', FROTA_INICIAL), ['SALA-GROUND']);
    assert.equal(recursosDaCategoria('C152', FROTA_INICIAL).length, 13);
    assert.deepEqual(recursosDaCategoria('C172', [{ reg: 'PR-NEW', tipo: 'C172' }]), ['PR-NEW']);
  });
});
