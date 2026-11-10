// Captura a saída do motor de alocação ORIGINAL (index.html do commit 9b5de75, antes da modularização)
// para os cenários usados em test/unit/engine.golden.test.js.
// Uso: node scripts/capturar-goldens-motor.mjs
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { gerarCenario, hashEstado } from '../test/helpers/cenarios.js';
import { estadoSintetico } from '../test/helpers/estado.js';

const COMMIT = '9b5de75';
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const DESTINO = new URL('../test/fixtures/motor-goldens.json', import.meta.url);

const html = execFileSync('git', ['show', `${COMMIT}:index.html`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage();
await page.route('http://acpm.test/**', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
await page.route(/^https:\/\//, r => r.abort());
await page.addInitScript(json => {
  if (!localStorage.getItem('acpm3')) localStorage.setItem('acpm3', json);
}, JSON.stringify(estadoSintetico()));
await page.goto('http://acpm.test/');

// Cenário do botão "Preencher exemplo" aplicado ao roster sintético
const exemplo = await page.evaluate(() => {
  demo();
  const estado = JSON.parse(JSON.stringify(S));
  return { estado, saida: runAllocationEngine(estado) };
});

const cenarios = [];
for (const seed of SEEDS) {
  const estado = gerarCenario(seed);
  const saida = await page.evaluate(st => runAllocationEngine(st), estado);
  cenarios.push({ seed, hash: hashEstado(estado), saida });
}

await browser.close();
await writeFile(DESTINO, JSON.stringify({ commit: COMMIT, exemplo, cenarios }) + '\n');
const total = cenarios.reduce((n, c) => n + c.saida.out.length, 0);
console.log(`${cenarios.length} cenários + exemplo capturados (${total} lançamentos) em ${DESTINO.pathname}`);
