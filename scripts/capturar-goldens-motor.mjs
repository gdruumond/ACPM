// Grava a saída APROVADA do motor de alocação (js/engine.js) para os cenários de test/unit/engine.golden.test.js.
// Rode somente depois de uma mudança intencional nas regras do motor e revise a diferença no PR.
// Uso: node scripts/capturar-goldens-motor.mjs
//
// Histórico: os goldens começaram como a saída do motor original (index.html do commit 9b5de75, fase 0);
// na fase 1 as regras do motor passaram a mudar de propósito (ver "Phase 1" em docs/PLAN.md).
import { readFile, writeFile } from 'node:fs/promises';
import { runAllocationEngine } from '../js/engine.js';
import { gerarCenario, hashEstado } from '../test/helpers/cenarios.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const DESTINO = new URL('../test/fixtures/motor-goldens.json', import.meta.url);
const semIndefinidos = valor => JSON.parse(JSON.stringify(valor));

// O estado do cenário de exemplo (roster sintético + demanda do antigo botão "Preencher exemplo") foi gravado da aplicação original
const { exemplo: { estado: estadoExemplo } } = JSON.parse(await readFile(DESTINO, 'utf8'));

const exemplo = { estado: estadoExemplo, saida: semIndefinidos(runAllocationEngine(estadoExemplo)) };
const cenarios = SEEDS.map(seed => {
  const estado = gerarCenario(seed);
  return { seed, hash: hashEstado(estado), saida: semIndefinidos(runAllocationEngine(estado)) };
});

await writeFile(DESTINO, JSON.stringify({ origem: 'js/engine.js', exemplo, cenarios }) + '\n');
const total = cenarios.reduce((n, c) => n + c.saida.out.length, 0);
console.log(`${cenarios.length} cenários + exemplo gravados (${total} lançamentos) em ${DESTINO.pathname}`);
