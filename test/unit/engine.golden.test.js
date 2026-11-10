// Garante que o motor modularizado produz exatamente a mesma escala que o motor original
// (capturado por scripts/capturar-goldens-motor.mjs a partir do index.html do commit 9b5de75).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runAllocationEngine } from '../../js/engine.js';
import { gerarCenario, hashEstado } from '../helpers/cenarios.js';

const goldens = JSON.parse(readFileSync(new URL('../fixtures/motor-goldens.json', import.meta.url), 'utf8'));
const semIndefinidos = valor => JSON.parse(JSON.stringify(valor));

test('cenário "Preencher exemplo" é idêntico ao motor original', () => {
  assert.deepEqual(semIndefinidos(runAllocationEngine(goldens.exemplo.estado)), goldens.exemplo.saida);
});

for (const { seed, hash, saida } of goldens.cenarios) {
  test(`cenário aleatório #${seed} é idêntico ao motor original`, () => {
    const estado = gerarCenario(seed);
    assert.equal(hashEstado(estado), hash, 'o gerador de cenários mudou: recapture os goldens');
    assert.deepEqual(semIndefinidos(runAllocationEngine(estado)), saida);
  });
}
