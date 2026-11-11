import { test, expect, abrirComExemplo, irPara, gerarEscala, confirmar, json, AMANHA } from './fixtures.js';

const lerBI = page => page.locator('#bi-content').evaluate(el => {
  const txt = n => n.innerText.replace(/\s+/g, ' ').trim();
  return {
    resumo: [...el.querySelectorAll('.st > div')].map(txt),
    tabelas: [...el.querySelectorAll('table')].map(t => [...t.querySelectorAll('tbody tr')].map(txt))
  };
});

test.describe('Dashboard BI', () => {
  test('registra o dia gerado, simula 30 dias, filtra e limpa', async ({ page }) => {
    await abrirComExemplo(page);
    await gerarEscala(page);
    await irPara(page, 'bi');
    await expect(page.locator('#bi-dt')).toHaveValue(AMANHA);
    const antes = json(await lerBI(page));
    expect(antes).toMatchSnapshot('bi-dia.json');

    const mesAntes = await page.locator('#bi-content .st > div').nth(2).innerText();
    await confirmar(page, '#btn-bi-sim');
    // O BI é recarregado das escalas guardadas: espera os dias simulados aparecerem
    await expect(page.locator('#bi-content .st > div').nth(2)).not.toHaveText(mesAntes);
    expect(json(await lerBI(page))).toMatchSnapshot('bi-30-dias.json');

    await page.locator('#bi-flt-eq').selectOption('C172');
    await page.locator('#bi-flt-ins').fill('instrutor 0');
    expect(json(await lerBI(page))).toMatchSnapshot('bi-filtrado.json');

    // "Limpar BI" tira só os dias simulados: o BI volta a mostrar apenas a escala gerada
    await page.locator('#bi-flt-eq').selectOption('');
    await page.locator('#bi-flt-ins').fill('');
    await confirmar(page, '#btn-bi-clr');
    await expect.poll(async () => json(await lerBI(page))).toBe(antes);
  });
});
