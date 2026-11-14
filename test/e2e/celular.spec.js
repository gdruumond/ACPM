// No celular (390 px): a escala em cartões, um por voo, e nenhuma aba rola para o lado.
import { test, expect, abrirComExemplo, abrirEscala, irPara } from './fixtures.js';

test.use({ viewport: { width: 390, height: 844 } });

const larguraDaPagina = page => page.evaluate(() => document.documentElement.scrollWidth);

// Controles da aba aberta e do topo com área de toque menor que 44 px (a caixa de seleção conta com o rótulo que a
// envolve; links no meio do texto ficam de fora)
const alvosPequenos = page => page.evaluate(() => {
  const secao = document.querySelector('main section.on');
  const controles = [...document.querySelectorAll('.topo button, .topo select, .topo input, #nav button'),
    ...secao.querySelectorAll('button, select, input, summary, a[href]')];
  const pequenos = new Set();
  for (const el of controles) {
    if (!el.checkVisibility({ visibilityProperty: true }) || el.matches('p a, .sr')) continue;
    const alvo = el.matches('input[type=checkbox]') ? (el.closest('label') || el) : el;
    const { width, height } = alvo.getBoundingClientRect();
    if (height < 44 || (!el.matches('select, input:not([type=checkbox]), summary') && width < 44)) {
      pequenos.add(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.dataset.f ? `[data-f=${el.dataset.f}]` : ''}${el.dataset.act ? `[data-act=${el.dataset.act}]` : ''} ${Math.round(width)}×${Math.round(height)}`);
    }
  }
  return [...pequenos];
});

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
    await page.locator('#s-esc [data-tl="painel"]').click();
    await expect(page.locator('#out .painel-dia')).toBeVisible();
    expect(await larguraDaPagina(page), 'painel').toBeLessThanOrEqual(390);
  });

  test('botões e campos com pelo menos 44 px para o dedo, em todas as abas', async ({ page }) => {
    await abrirComExemplo(page);
    for (const aba of ['esc', 'dem', 'age', 'rec', 'ins', 'alu', 'rod', 'bi']) {
      await irPara(page, aba);
      expect(await alvosPequenos(page), `aba ${aba}`).toEqual([]);
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
