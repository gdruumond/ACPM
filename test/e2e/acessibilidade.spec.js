// Acessibilidade: cada botão e cada campo tem um nome para o leitor de tela, e nenhum se chama só "✕" (que o leitor
// lê como "multiplicação"). Vale para todas as abas, o Histórico e o painel de habilitações.
import { test, expect, abrirComExemplo, irPara } from './fixtures.js';

// Nome acessível, do jeito simples: aria-label, aria-labelledby, o rótulo do campo, o texto do botão ou a dica
const semNome = (page, raiz) => page.evaluate(seletor => {
  const nome = el => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const por = el.getAttribute('aria-labelledby');
    if (por) return por.split(' ').map(id => (document.getElementById(id) || {}).textContent || '').join(' ');
    if (el.labels && el.labels.length) return [...el.labels].map(l => l.textContent).join(' ');
    // Sem texto, o leitor de tela usa a dica (title)
    if (el.matches('button, summary, a') && el.textContent.trim()) return el.textContent;
    return el.title || '';
  };
  const problemas = new Set();
  for (const raiz of document.querySelectorAll(seletor)) {
    for (const el of raiz.querySelectorAll('button, select, input, textarea, summary, a[href]')) {
      if (!el.checkVisibility() && !el.matches('input[type=checkbox]')) continue;
      if (el.matches('input[type=checkbox]') && !el.closest('label, td, th, li')?.checkVisibility()) continue;
      const n = nome(el).replace(/\s+/g, ' ').trim();
      if (!n || n === '✕' || n === '×') {
        problemas.add(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.dataset.f ? `[data-f=${el.dataset.f}]` : ''}${el.dataset.act ? `[data-act=${el.dataset.act}]` : ''}${el.dataset.a ? `[data-a=${el.dataset.a}]` : ''} "${n}"`);
      }
    }
  }
  return [...problemas];
}, raiz);

test.describe('Acessibilidade', () => {
  test('todo botão e todo campo tem nome para o leitor de tela, em todas as abas', async ({ page }) => {
    await abrirComExemplo(page);
    for (const aba of ['esc', 'dem', 'age', 'rec', 'ins', 'alu', 'rod', 'bi']) {
      await irPara(page, aba);
      expect(await semNome(page, '.topo, #nav, main section.on'), `aba ${aba}`).toEqual([]);
    }
    await irPara(page, 'esc');
    for (const vista of ['eq', 'ins', 'painel']) {
      await page.locator(`#s-esc [data-tl="${vista}"]`).click();
      expect(await semNome(page, 'main section.on'), `mapa ${vista}`).toEqual([]);
    }
    await irPara(page, 'ins');
    await page.locator('#s-ins [data-vista-ins="cadastro"]').click();
    expect(await semNome(page, 'main section.on'), 'cadastro de instrutores').toEqual([]);
    await page.locator('#inst [data-act="editar-habs"]').first().click();
    expect(await semNome(page, '#painel-instrutor'), 'painel de habilitações').toEqual([]);
    await page.keyboard.press('Escape');
    await page.locator('#btn-open-log').click();
    expect(await semNome(page, '#historico'), 'histórico').toEqual([]);
  });
});
