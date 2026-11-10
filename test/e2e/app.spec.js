import { test, expect, abrir, irPara } from './fixtures.js';

test.describe('Aplicação', () => {
  test('carrega com as seis abas e a aba Recursos ativa', async ({ page }) => {
    await abrir(page);
    await expect(page).toHaveTitle('Escala de Voo — ACPM');
    await expect(page.locator('#nav button')).toHaveText([
      '1 · Recursos', '2 · Instrutores', '3 · Alunos', '4 · Demanda', '5 · Escala', '6 · Rodízio', '7 · BI'
    ]);
    await expect(page.locator('#s-rec')).toBeVisible();
    await expect(page.locator('#s-ins')).toBeHidden();
  });

  test('navega pelas abas e pelos botões "Próximo"', async ({ page }) => {
    await abrir(page);
    for (const aba of ['ins', 'alu', 'dem', 'esc', 'bi', 'rec']) {
      await irPara(page, aba);
      await expect(page.locator(`#nav button[data-t="${aba}"]`)).toHaveClass(/\bon\b/);
      await expect(page.locator('section.on')).toHaveCount(1);
    }
    await page.locator('#s-rec [data-go="ins"]').click();
    await expect(page.locator('#s-ins')).toBeVisible();
    await page.locator('#s-ins [data-go="alu"]').click();
    await expect(page.locator('#s-alu')).toBeVisible();
  });

  test('aplica a folha de estilos (tokens de cor, layout e fontes)', async ({ page }) => {
    const fontes = [];
    page.on('request', r => { if (r.url().startsWith('https://fonts.googleapis.com/css2?family=Barlow')) fontes.push(r.url()); });
    await abrir(page);
    const estilos = () => page.evaluate(() => ({
      tinta: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
      fundo: getComputedStyle(document.body).backgroundColor,
      fonte: getComputedStyle(document.body).fontFamily,
      secaoInativa: getComputedStyle(document.querySelector('#s-bi')).display,
      principalMax: getComputedStyle(document.querySelector('main')).maxWidth
    }));
    expect(await estilos()).toEqual({
      tinta: '#12263A', fundo: 'rgb(232, 237, 241)', fonte: expect.stringContaining('Barlow'), secaoInativa: 'none', principalMax: '1280px'
    });
    expect(fontes).toHaveLength(1);

    await page.locator('#btn-theme').click();
    expect((await estilos()).fundo).not.toBe('rgb(232, 237, 241)');
  });

  test('alterna o tema e lembra a escolha após recarregar', async ({ page }) => {
    await abrir(page);
    const html = page.locator('html');
    await page.locator('#btn-theme').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.locator('#btn-theme').click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('abre o manual do usuário na aba BI', async ({ page }) => {
    await abrir(page);
    await irPara(page, 'bi');
    const manual = page.locator('details.manual-panel');
    await manual.locator('summary').click();
    await expect(manual.locator('.manual-card')).toHaveCount(6);
  });
});
