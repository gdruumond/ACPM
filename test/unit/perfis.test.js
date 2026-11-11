// Perfis de acesso no modo compartilhado e o que cada um pode fazer.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PERFIS, ROTULOS, operaEscala, registraNaAgenda, gerenciaContas } from '../../js/perfis.js';

describe('Perfis de acesso', () => {
  it('quatro perfis, com os nomes da tela', () => {
    assert.deepEqual(PERFIS, ['operador', 'gestor', 'secretaria', 'administrador']);
    assert.deepEqual(PERFIS.map(p => ROTULOS[p]), ['Operador', 'Gestor', 'Secretaria', 'Administrador']);
  });

  it('o administrador tem tudo o que o operador tem e, além disso, gerencia as contas', () => {
    const pode = p => [operaEscala(p), registraNaAgenda(p), gerenciaContas(p)];
    assert.deepEqual(pode('administrador'), [true, true, true]);
    assert.deepEqual(pode('operador'), [true, true, false]);
    assert.deepEqual(pode('secretaria'), [false, true, false]);
    assert.deepEqual(pode('gestor'), [false, false, false]);
    assert.deepEqual(pode(null), [false, false, false]);
    assert.deepEqual(pode('constructor'), [false, false, false]);
  });
});
