// No celular (390 px): a escala em cartões, um por voo, e nenhuma aba rola para o lado.
import { test, expect, abrirComExemplo, abrirEscala, irPara } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 } });

const larguraDaPagina = page => page.evaluate(() => document.documentElement.scrollWidth);

test.describe('Celular', () => {
  test('nenhuma aba rola para o lado; o mapa rola dentro do próprio painel', async ({ page }) => {
    await abrirComExemplo(page);
    for (const aba of ['esc', 'dem', 'age', 'rec', 'ins', 'alu', 'rod', 'bi']) {
      await irPara(page, aba);
      expect(await larguraDaPagina(page), `aba ${aba}`).toBeLessThanOrEqual(390);
    }
    await irPara(page, 'esc');
    for (const vista of ['eq', 'ins']) {
      await page.locator(`#s-esc [data-tl="${vista}"]`).click();
      await expect(page.locator('#out .mapa')).toBeVisible();
      expect(await larguraDaPagina(page), `mapa ${vista}`).toBeLessThanOrEqual(390);
    }
  });

  test('a escala vira um cartão por voo, com horário, aluno, missão, avião, instrutor e status à vista', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await expect(page.locator('#out thead')).toBeHidden();
    const cartao = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 12' });
    expect(await cartao.evaluate(el => getComputedStyle(el).display)).toBe('grid');
    for (const campo of ['.c-hr', '.c-aluno', '.c-missao', '.c-aviao', '.c-instr', '.c-status']) {
      const caixa = await cartao.locator(campo).boundingBox();
      expect(caixa, campo).not.toBeNull();
      expect(caixa.x + caixa.width, campo).toBeLessThanOrEqual(390);
    }
    await expect(cartao.locator('.c-instr')).toContainText('Instrutor 13');
  });
});
