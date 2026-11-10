// Garante que o motor continua produzindo exatamente a escala aprovada para cada cenário
// (gravada por scripts/capturar-goldens-motor.mjs; mudanças intencionais no motor exigem regravar e revisar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runAllocationEngine } from '../../js/engine.js';
import { gerarCenario, hashEstado } from '../helpers/cenarios.js';

const goldens = JSON.parse(readFileSync(new URL('../fixtures/motor-goldens.json', import.meta.url), 'utf8'));
const semIndefinidos = valor => JSON.parse(JSON.stringify(valor));

test('cenário "Preencher exemplo" mantém a escala aprovada', () => {
  assert.deepEqual(semIndefinidos(runAllocationEngine(goldens.exemplo.estado)), goldens.exemplo.saida);
});

for (const { seed, hash, saida } of goldens.cenarios) {
  test(`cenário aleatório #${seed} mantém a escala aprovada`, () => {
    const estado = gerarCenario(seed);
    assert.equal(hashEstado(estado), hash, 'o gerador de cenários mudou: recapture os goldens');
    assert.deepEqual(semIndefinidos(runAllocationEngine(estado)), saida);
  });
}
