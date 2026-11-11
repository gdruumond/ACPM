import { test, expect, abrir, irPara } from './fixtures.js';

test.describe('Aplicação', () => {
  test('carrega com as seis abas e a aba Recursos ativa', async ({ page }) => {
    await abrir(page);
    await expect(page).toHaveTitle('Escala de Voo — ACPM');
    await expect(page.locator('#nav button')).toHaveText([
      '1 · Recursos', '2 · Instrutores', '3 · Alunos', '4 · Agenda', '5 · Demanda', '6 · Escala', '7 · Rodízio', '8 · BI'
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

  test('o botão Manual abre, de qualquer aba, o manual com as regras em vigor', async ({ page }) => {
    await abrir(page);
    await irPara(page, 'dem');
    await page.locator('#btn-manual').click();
    const manual = page.locator('#s-manual');
    await expect(manual).toBeVisible();
    await expect(page.locator('#s-dem')).toBeHidden();

    // As tabelas de regras saem do código (missões, janelas, pesos e rodízio)
    await expect(page.locator('#manual-missoes tbody tr')).toHaveCount(18);
    await expect(page.locator('#manual-missoes tbody tr', { hasText: 'Cheque PC MLTE IFR' })).toContainText('Checador MLTE IFR');
    await expect(page.locator('#manual-janelas li')).toHaveCount(9);
    await expect(page.locator('#manual-pesos')).toContainText('C152: 170 kg');
    await expect(page.locator('#manual-rodizio li')).toHaveText(['Voos de cheque', 'Voo MLTE (PA-34)', 'Voo noturno', 'Voo C172']);

    // Nada das regras antigas
    const texto = await manual.innerText();
    for (const antigo of ['A01', 'A09', 'Gerar escala', 'Preencher exemplo', 'Link Blindado']) expect(texto).not.toContain(antigo);
    for (const secao of ['Primeiros passos', 'Perfis de acesso', 'Como a escala é montada', 'Para o gestor', 'Perguntas frequentes']) {
      await expect(manual.locator('h3', { hasText: secao })).toHaveCount(1);
    }

    // O índice leva às seções e as abas continuam funcionando
    await manual.locator('.manual-indice a[href="#manual-regras"]').click();
    await expect(page.locator('#manual-regras')).toBeInViewport();
    await irPara(page, 'esc');
    await expect(manual).toBeHidden();
  });

  test('o manual saiu do fim da aba BI', async ({ page }) => {
    await abrir(page);
    await irPara(page, 'bi');
    await expect(page.locator('#s-bi details, #s-bi .manual-panel')).toHaveCount(0);
  });
});
