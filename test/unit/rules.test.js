import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGroundMission, reqInsLevel, doesGroundGateFlight, migrateLegacyMissionName, normalizeMissionFields, blank
} from '../../js/rules.js';

describe('Regras de missão', () => {
  it('identifica as missões de Ground School', () => {
    assert.deepEqual(
      ['Ground C152', 'Ground C172', 'Ground PA-34', 'Ground Navegação', 'Voo Local', 'Simulador', 'Inexistente'].map(isGroundMission),
      [true, true, true, true, false, false, false]
    );
  });

  it('nível mínimo combina missão e equipamento (Ground sempre A01)', () => {
    assert.equal(reqInsLevel('Ground PA-34', 'Sala Ground'), 1);
    assert.equal(reqInsLevel('Voo Local', 'C152'), 1);
    assert.equal(reqInsLevel('Voo Local', 'C172'), 7);
    assert.equal(reqInsLevel('Navegação', 'PA-34'), 9);
    assert.equal(reqInsLevel('Simulador', 'Sim. Multi'), 2);
    assert.equal(reqInsLevel('IFR', 'C172'), 8);
    assert.equal(reqInsLevel('Missão desconhecida', 'C152'), 1);
  });

  it('Ground de aeronave libera voos naquele equipamento; Ground Navegação libera Navegação', () => {
    assert.equal(doesGroundGateFlight('Ground C152', { mis: 'Voo Local', eq: 'C152' }), true);
    assert.equal(doesGroundGateFlight('Ground C152', { mis: 'Voo Local', eq: 'C172' }), false);
    assert.equal(doesGroundGateFlight('Ground PA-34', { mis: 'Multimotor', eq: 'PA-34' }), true);
    assert.equal(doesGroundGateFlight('Ground Navegação', { mis: 'Navegação', eq: 'C172' }), true);
    assert.equal(doesGroundGateFlight('Ground Navegação', { mis: 'Voo Local', eq: 'C152' }), false);
    assert.equal(doesGroundGateFlight('Ground C152', { mis: 'Ground C172', eq: 'Sala Ground' }), false);
    assert.equal(doesGroundGateFlight('Voo Local', { mis: 'Voo Local', eq: 'C152' }), false);
  });

  it('migra nomes de missão das versões anteriores', () => {
    assert.deepEqual(
      ['PP Local', 'PP Navegação (>27nm)', 'PC Visual', 'Multi', 'INVA', 'TGL', 'Ground de Navegação', 'IFR', '???'].map(migrateLegacyMissionName),
      ['Voo Local', 'Navegação', 'Voo Local', 'Multimotor', 'Voo Local', 'Voo Local', 'Ground Navegação', 'IFR', 'Voo Local']
    );
  });

  it('normaliza pedidos de Ground: sala, 01h30, sessão única e sem janela noturna', () => {
    const pedido = { mis: 'Ground C172', eq: 'C172', p1: 8, p2: 8, nb: 3, ss: 2 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Ground C172', eq: 'Sala Ground', p1: 0, p2: 1, nb: 1.5, ss: 1 });
  });

  it('normaliza pedidos de voo: equipamento permitido e horas inteiras', () => {
    const pedido = { mis: 'Multi', eq: 'C152', p1: 1, p2: 2, nb: 1.5, ss: 1 };
    normalizeMissionFields(pedido);
    assert.deepEqual(pedido, { mis: 'Multimotor', eq: 'PA-34', p1: 1, p2: 2, nb: 1, ss: 1 });
  });

  it('pedido em branco é um objeto novo a cada chamada', () => {
    const a = blank();
    assert.deepEqual(a, { fly: false, mis: 'Voo Local', eq: 'C152', p1: 1, p2: 2, nb: 1, ss: 1, pr: 3 });
    assert.notEqual(blank(), a);
  });
});
