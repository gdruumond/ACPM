import { test, expect, abrirComExemplo, irPara, abrirEscala, confirmar, json, AMANHA } from './fixtures.js';

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
    await abrirEscala(page);
    await irPara(page, 'bi');
    await expect(page.locator('#bi-dt')).toHaveValue(AMANHA);
    const antes = json(await lerBI(page));
    expect(antes).toMatchSnapshot('bi-dia.json');

    const mesAntes = await page.locator('#bi-content .st > div').nth(2).innerText();
    await confirmar(page, '#btn-bi-sim');
    // O BI é recarregado das escalas guardadas: espera os dias simulados aparecerem
    await expect(page.locator('#bi-content .st > div').nth(2)).not.toHaveText(mesAntes);
    expect(json(await lerBI(page))).toMatchSnapshot('bi-30-dias.json');

    await page.locator('#bi-flt-cat').selectOption('C172');
    await page.locator('#bi-flt-ins').fill('instrutor 0');
    expect(json(await lerBI(page))).toMatchSnapshot('bi-filtrado.json');

    // "Limpar BI" tira só os dias simulados: o BI volta a mostrar apenas a escala gerada
    await page.locator('#bi-flt-cat').selectOption('');
    await page.locator('#bi-flt-ins').fill('');
    await confirmar(page, '#btn-bi-clr');
    await expect.poll(async () => json(await lerBI(page))).toBe(antes);
  });

  test('os filtros seguem a Escala: Categoria e, dentro dela, Recurso; nada de "aviões e salas"', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'bi');
    expect(await page.locator('#s-bi').innerText()).not.toMatch(/avi(ão|ões) (e|ou|\/) sala/i);
    await expect(page.locator('#s-bi label.flt-rotulo > span')).toHaveText(['Categoria', 'Recurso']);
    await expect(page.locator('#bi-content h3').first()).toHaveText('Horas por recurso (dia, semana e mês)');
    await expect(page.locator('#bi-content [data-bi="eq"] thead th').first()).toHaveText('Recurso');
    const categoria = page.locator('#bi-flt-cat'), recurso = page.locator('#bi-flt-eq');
    await expect(categoria.locator('option')).toHaveText(['Todos', 'C152', 'C172', 'Simulador', 'PA-34', 'Sala Ground']);
    await expect(recurso).toHaveValue('');
    await categoria.selectOption({ label: 'PA-34' });
    await expect(recurso.locator('option')).toHaveText(['Todos', 'PR-VOM', 'PT-JOB', 'PT-KIW']);
    await expect(page.locator('#bi-content [data-bi="eq"] tbody tr')).toHaveCount(3);
    await recurso.selectOption('PR-VOM');
    await expect(page.locator('#bi-content [data-bi="eq"] tbody tr')).toHaveCount(1);
    await expect(page.locator('#bi-content [data-bi="eq"] tbody tr')).toContainText('PR-VOM');
    await categoria.selectOption({ label: 'Simulador' });
    await expect(recurso).toHaveValue('');
    await expect(page.locator('#bi-content [data-bi="eq"] tbody tr')).toHaveCount(4);
  });

  test('horas por avião e por instrutor: os 10 maiores e "Ver todos"', async ({ page }) => {
    await abrirComExemplo(page);
    await irPara(page, 'bi');
    for (const tabela of ['eq', 'ins']) {
      const linhas = page.locator(`#bi-content [data-bi="${tabela}"] tbody tr`);
      await expect(linhas).toHaveCount(10);
      const verTodos = page.locator(`#bi-content [data-bi-todos="${tabela}"]`);
      await expect(verTodos).toHaveText(/^Ver todos \(\d+\)$/);
      await verTodos.click();
      expect(await linhas.count()).toBeGreaterThan(10);
      await expect(page.locator(`#bi-content [data-bi-todos="${tabela}"]`)).toHaveText('Ver só os 10 maiores');
    }
  });
});
