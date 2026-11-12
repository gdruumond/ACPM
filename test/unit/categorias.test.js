// Categorias de recurso dos filtros da Escala e de Recursos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIAS, categoriaDoRecurso, recursosDaCategoria } from '../../js/categorias.js';

describe('Categorias de recurso', () => {
  it('na ordem da operação: C152, C172, Simulador, PA-34 e Sala Ground', () => {
    assert.deepEqual(CATEGORIAS.map(c => c.nome), ['C152', 'C172', 'Simulador', 'PA-34', 'Sala Ground']);
  });

  it('a categoria de cada matrícula, dos simuladores e da sala de Ground', () => {
    assert.equal(categoriaDoRecurso('PP-LJV'), 'C152');
    assert.equal(categoriaDoRecurso('PR-JPL'), 'C152');
    assert.equal(categoriaDoRecurso('PP-AJS'), 'C172');
    assert.equal(categoriaDoRecurso('SIM-MONO-A'), 'sim');
    assert.equal(categoriaDoRecurso('SIM-MLTE-D'), 'sim');
    assert.equal(categoriaDoRecurso('PT-KIW'), 'PA-34');
    assert.equal(categoriaDoRecurso('SALA-GROUND'), 'ground');
    assert.equal(categoriaDoRecurso('XX-XXX'), null);
  });

  it('os recursos de cada categoria', () => {
    assert.deepEqual(recursosDaCategoria('PA-34'), ['PR-VOM', 'PT-JOB', 'PT-KIW']);
    assert.deepEqual(recursosDaCategoria('sim'), ['SIM-MONO-A', 'SIM-MONO-C', 'SIM-MLTE-E', 'SIM-MLTE-D']);
    assert.deepEqual(recursosDaCategoria('ground'), ['SALA-GROUND']);
    assert.equal(recursosDaCategoria('C152').length, 13);
  });
});
