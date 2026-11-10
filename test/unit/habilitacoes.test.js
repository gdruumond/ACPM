// Habilitações individuais dos instrutores: substituem os níveis cumulativos A01–A09.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HABILITACOES, habilitacoesDoNivel, normalizarHabilitacoes, podeFazer, descreverExigencias } from '../../js/habilitacoes.js';
import { MIS } from '../../js/config.js';

// Regra dos níveis cumulativos (até a fase 3), congelada aqui: a migração não pode mudar quem pode fazer o quê
const NIVEL_DA_MISSAO = { 'Simulador': 2, 'Voo Local': 1, 'Navegação': 4, 'Voo Solo': 5, 'Parafuso': 6, 'IFR': 8, 'Noturno': 7, 'Multimotor': 9 };
const NIVEL_DO_EQUIPAMENTO = { 'Sala Ground': 1, 'C152': 1, 'Sim. Mono': 2, 'Sim. Multi': 2, 'C172': 7, 'PA-34': 9 };
const nivelExigido = (mis, eq) => (mis.startsWith('Ground') ? 1 : Math.max(NIVEL_DA_MISSAO[mis], NIVEL_DO_EQUIPAMENTO[eq]));
const MISSOES_DA_FASE_3 = ['Ground C152', 'Ground C172', 'Ground PA-34', 'Ground Navegação', ...Object.keys(NIVEL_DA_MISSAO)];
const com = (...hab) => ({ hab });

describe('Habilitações individuais', () => {
  it('a migração dá a cada nível exatamente o que ele permitia (todas as missões e equipamentos)', () => {
    let casos = 0;
    for (let lv = 1; lv <= 9; lv++) {
      const instrutor = { hab: habilitacoesDoNivel(lv) };
      for (const mis of MISSOES_DA_FASE_3) {
        for (const eq of MIS[mis].eq) {
          assert.equal(podeFazer(instrutor, mis, eq), lv >= nivelExigido(mis, eq), `A0${lv} em ${mis} no ${eq}`);
          casos++;
        }
      }
    }
    assert.equal(casos, 9 * 22);
  });

  it('o que cada nível recebe; quem tem mais nível tem mais habilitações (os checadores começam desmarcados)', () => {
    assert.deepEqual(habilitacoesDoNivel(1), ['grounds', 'ground_pa34', 'local']);
    assert.deepEqual(habilitacoesDoNivel(3), ['grounds', 'ground_pa34', 'sim_mono', 'sim_multi', 'tgl', 'local']);
    assert.deepEqual(habilitacoesDoNivel(9), HABILITACOES.map(h => h.id).filter(h => !h.startsWith('checador')));
    assert.deepEqual(habilitacoesDoNivel('x'), habilitacoesDoNivel(1), 'nível inválido conta como A01');
    for (let lv = 2; lv <= 9; lv++) assert.ok(habilitacoesDoNivel(lv).length > habilitacoesDoNivel(lv - 1).length);
  });

  it('não são cumulativas: instrutor de C172 sem simulador, de PA-34 sem parafuso', () => {
    const c172 = com('local', 'navegacao', 'noturno', 'c172');
    assert.equal(podeFazer(c172, 'Voo Local', 'C172'), true);
    assert.equal(podeFazer(c172, 'Noturno', 'C172'), true);
    assert.equal(podeFazer(c172, 'Simulador', 'Sim. Mono'), false);
    const pa34 = com('local', 'mlte');
    assert.equal(podeFazer(pa34, 'Multimotor', 'PA-34'), true);
    assert.equal(podeFazer(pa34, 'Parafuso', 'PA-34'), false);
    assert.equal(podeFazer(pa34, 'Voo Local', 'C172'), false, 'PA-34 não habilita C172');
    assert.equal(podeFazer(com('sim_multi'), 'Simulador', 'Sim. Mono'), false);
    assert.equal(podeFazer(com('ground_pa34'), 'Ground C152', 'Sala Ground'), false);
    assert.equal(podeFazer({}, 'Voo Local', 'C152'), false, 'sem habilitações não faz nada');
  });

  it('normaliza a lista: só habilitações conhecidas, sem repetição, na ordem da grade', () => {
    assert.deepEqual(normalizarHabilitacoes(['c172', 'xyz', 'local', 'c172', 7]), ['local', 'c172']);
    assert.deepEqual(normalizarHabilitacoes('local'), []);
  });

  it('TGL (TMA) exige a habilitação TGL (TMA) e a do avião', () => {
    assert.equal(podeFazer(com('tgl'), 'TGL (TMA)', 'C152'), true);
    assert.equal(podeFazer(com('tgl'), 'TGL (TMA)', 'C172'), false);
    assert.equal(podeFazer(com('tgl', 'c172'), 'TGL (TMA)', 'C172'), true);
    assert.equal(podeFazer(com('local'), 'TGL (TMA)', 'C152'), false);
  });

  it('voos de cheque exigem o checador credenciado para aquele cheque (só a habilitação de checador)', () => {
    const vfr = com('checador_vfr'), ifr = com('checador_ifr'), mlte = com('checador_mlte');
    const pode = (mis, eq) => [vfr, ifr, mlte].map(x => podeFazer(x, mis, eq));
    assert.deepEqual(pode('Cheque PP', 'C152'), [true, true, true]);
    assert.deepEqual(pode('Cheque PC MNTE VFR', 'C172'), [true, true, true], 'no C172 também não exige a habilitação C172');
    assert.deepEqual(pode('Cheque PC MNTE IFR', 'C172'), [false, true, true]);
    assert.deepEqual(pode('Cheque PC MLTE VFR', 'PA-34'), [false, false, true]);
    assert.deepEqual(pode('Cheque PC MLTE IFR', 'PA-34'), [false, false, true]);
    assert.equal(podeFazer(com('local', 'ifr', 'c172', 'mlte'), 'Cheque PP', 'C152'), false, 'sem checador, não faz cheque');
  });

  it('descreve o que a missão exige', () => {
    assert.equal(descreverExigencias('IFR', 'C172'), 'Voo IFR + C172');
    assert.equal(descreverExigencias('Multimotor', 'PA-34'), 'MLTE (PA-34)');
    assert.equal(descreverExigencias('Simulador', 'Sim. Multi'), 'Simulador (Multi)');
    assert.equal(descreverExigencias('Ground Navegação', 'Sala Ground'), 'Grounds (C152, C172 e Navegação)');
    assert.equal(descreverExigencias('TGL (TMA)', 'C172'), 'TGL (TMA) + C172');
    assert.equal(descreverExigencias('Cheque PC MNTE IFR', 'C172'), 'Checador PP, PC, MNTE, INVA, IFR ou Checador PP, PC, MLTE, MNTE, INVA, IFR');
  });
});
