import { test, expect, prepararContexto, vigiarErros } from './fixtures.js';
import { rosterSintetico } from '../helpers/estado.js';

// Cada campo do link compartilhado recebe um HTML que, se for interpretado, registra o nome do campo em window.__xss
const ataque = campo => `"><img src=x onerror="window.__xss=(window.__xss||[]).concat('${campo}')">`;
const codificar = obj => encodeURIComponent(Buffer.from(JSON.stringify(obj), 'utf8').toString('base64'));

function payloadMalicioso() {
  const ins = rosterSintetico().map(x => [x.id, x.nm, 1, x.lv, x.kg, x.aw.map(() => 1)]);
  ins[0][1] = ataque('nome-instrutor');
  ins[1][3] = ataque('nivel');
  ins[2][4] = ataque('peso-instrutor');
  return {
    d: '2026-11-11',
    // Só a janela das 08:20: a missão extra do aluno conflita com a principal e gera um alerta com o nome dele
    w: [0, 1, 0, 0, 0, 0, 0, 0, 0],
    avOff: [],
    ins,
    st: { '1000_0_1': ataque('status') },
    fly: [
      [1000, ataque('nome-aluno'), ataque('peso-aluno'), [], 1, 'Voo Local', 'C152', 1, 1, 1, 1, ataque('prioridade'),
        [[1001, 'Voo Local', 'C152', 1, 1, 1, 1, 3]]],
      [ataque('id'), 'Aluno Y', 70, [], 1, 'Voo Local', 'C152', 1, 1, 1, 1, 3, []]
    ]
  };
}

test.describe('Segurança do link compartilhado', () => {
  test('conteúdo malicioso no link não é executado nem vira HTML', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    await prepararContexto(contexto);
    const page = await contexto.newPage();
    const erros = vigiarErros(page);
    await page.goto(`./?role=gestor&share=${codificar(payloadMalicioso())}`);
    await expect(page.locator('#s-esc')).toBeVisible();
    for (const aba of ['rec', 'ins', 'alu', 'dem', 'bi', 'esc']) await page.locator(`#nav button[data-t="${aba}"]`).click();

    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(page.locator('#out .al.err')).toContainText('conflito de horário');
    await expect(page.locator('#alu .cd')).toHaveCount(1);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});
