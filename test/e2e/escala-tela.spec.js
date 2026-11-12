// Tela da Escala: Lista, Por recurso ou Por instrutor; resumo com erros e avisos agrupados; uma linha por voo.
import { test, expect, abrir, abrirComExemplo, abrirEscala, irPara, lerEscala } from './fixtures.js';
import { aluno, cenario, instrutor, GROUND_C152 } from '../helpers/montar.js';

test.describe('Tela da Escala', () => {
  test('a barra troca entre Lista, Por recurso e Por instrutor', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await expect(page.locator('#s-esc [data-tl]')).toHaveText(['Lista', 'Por recurso', 'Por instrutor']);
    await expect(page.locator('#s-esc [data-tl="lista"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('#out table')).toBeVisible();
    await expect(page.locator('#out .mapa')).toBeHidden();

    await page.locator('#s-esc [data-tl="eq"]').click();
    await expect(page.locator('#out .mapa')).toBeVisible();
    await expect(page.locator('#out table')).toBeHidden();
    await expect(page.locator('#out .tl-row .tl-lbl').first()).toContainText(/^P[PRT]-|^SIM-|^Sala Ground/);

    await page.locator('#s-esc [data-tl="ins"]').click();
    await expect(page.locator('#out .tl-row .tl-lbl').first()).toContainText('Instrutor');
    await page.locator('#s-esc [data-tl="lista"]').click();
    await expect(page.locator('#out table')).toBeVisible();
  });

  test('resumo: os números numa linha; o que não entrou numa caixa vermelha aberta; os avisos agrupados numa caixa fechada', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 1)], stu: [
      aluno(1000, { mis: 'Multimotor', eq: 'PA-34' }),
      aluno(1001, {}, { kg: 0 }),
      aluno(1002, {}, { kg: 0 })
    ] }) });
    await abrirEscala(page);
    await expect(page.locator('#out .st > div')).toHaveText(['3 missões pedidas', '2 escaladas', '2 h de voo e aula']);
    const erros = page.locator('#out details.caixa.erros');
    await expect(erros).toHaveAttribute('open', '');
    await expect(erros.locator('summary')).toHaveText('1 missão não entrou na escala: Aluno 1000');
    await expect(erros.locator('.al.err')).toContainText('nenhum instrutor ativo habilitado');
    const avisos = page.locator('#out details.caixa.avisos');
    await expect(avisos).not.toHaveAttribute('open', '');
    await expect(avisos.locator('summary')).toHaveText('2 avisos: 2 alunos sem peso');
    await expect(avisos.locator('.al.warn')).toHaveCount(2);
  });

  test('uma linha por voo: duração junto do horário, preferência só quando não é a 1ª, peso com o limite e status discreto', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [
      aluno(1000, { mis: 'Voo Local', eq: 'C152', p1: 0, p2: 1 }),
      aluno(1001, { mis: 'Voo Local', eq: 'C152', p1: 0, p2: 1 })
    ] }) });
    await abrirEscala(page);
    await expect(page.locator('#out thead th')).toHaveText(['Horário', 'Aluno', 'Missão', 'Recurso', 'Instrutor', 'Peso', 'Status', '']);
    await expect(page.locator('#out tr.win').first()).toHaveText('06:30 · 1º tempo 1 decolagem ou aula');
    const primeiro = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1000' });
    await expect(primeiro.locator('td').nth(0)).toHaveText('06:30–07:30 1 h');
    await expect(primeiro.locator('td').nth(5)).toHaveText('140 / 170 kg');
    await expect(primeiro.locator('.st-sel')).toHaveValue('Confirmado');
    await expect(primeiro.locator('[data-act="rm-fly"]')).toHaveAttribute('aria-label', 'Tirar Aluno 1000 da escala');
    const segundo = page.locator('#out tbody tr:not(.win)', { hasText: 'Aluno 1001' });
    await expect(segundo.locator('td').nth(0)).toContainText('2ª preferência');
  });

  test('turma de Ground: horário, missão, sala e instrutor uma vez só; cada aluno com o seu status e a sua ação', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 9)], stu: [1000, 1001, 1002].map(id => aluno(id, { ...GROUND_C152, p1: 0, p2: 1 })) }) });
    await abrirEscala(page);
    const linhas = page.locator('#out tbody tr:not(.win)');
    await expect(linhas).toHaveCount(3);
    await expect(linhas.nth(0).locator('td')).toHaveCount(8);
    await expect(linhas.nth(0).locator('td').first()).toHaveAttribute('rowspan', '3');
    await expect(linhas.nth(0).locator('td').nth(2)).toContainText('Turma de 3 alunos');
    await expect(linhas.nth(1).locator('td')).toHaveCount(3);
    await expect(linhas.nth(1).locator('.st-sel')).toHaveCount(1);
    await expect(linhas.nth(1).locator('td').nth(0)).toHaveText('Aluno 1001');
  });

  test('Categoria e Recurso: os dois começam em "Todos", e o segundo mostra só os da categoria escolhida', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    await expect(page.locator('#s-esc label.flt-rotulo > span')).toHaveText(['Categoria', 'Recurso']);
    const categoria = page.locator('#flt-esc-cat'), recurso = page.locator('#flt-esc-eq');
    await expect(categoria.locator('option')).toHaveText(['Todos', 'C152', 'C172', 'Simulador', 'PA-34', 'Sala Ground']);
    await expect(categoria).toHaveValue('');
    await expect(recurso).toHaveValue('');
    await expect(recurso.locator('option').first()).toHaveText('Todos');
    const avioesDasLinhas = async () => (await lerEscala(page)).linhas.map(l => l.split(' | ')).filter(c => c.length >= 5).map(c => c[3]);

    await categoria.selectOption({ label: 'PA-34' });
    const opcoes = await recurso.locator('option').allTextContents();
    expect(opcoes[0]).toBe('Todos');
    expect(opcoes.length).toBeGreaterThan(1);
    expect(opcoes.slice(1).every(r => ['PR-VOM', 'PT-JOB', 'PT-KIW'].includes(r)), opcoes.join(', ')).toBe(true);
    const pa34 = await avioesDasLinhas();
    expect(pa34.length).toBeGreaterThan(0);
    expect(pa34.every(a => a.endsWith(' PA-34')), pa34.join(', ')).toBe(true);

    // Um avião da categoria; trocar de categoria volta o segundo filtro para "Todos"
    await recurso.selectOption(opcoes[1]);
    expect((await avioesDasLinhas()).every(a => a.startsWith(opcoes[1] + ' '))).toBe(true);
    await categoria.selectOption({ label: 'Sala Ground' });
    await expect(recurso).toHaveValue('');
    await expect(recurso.locator('option')).toHaveText(['Todos', 'Sala Ground']);
    expect(new Set(await avioesDasLinhas())).toEqual(new Set(['Sala Ground']));
    await categoria.selectOption({ label: 'Todos' });
    expect((await avioesDasLinhas()).length).toBeGreaterThan(pa34.length);
  });

  test('na Lista, cada horário recolhe e abre os voos dele (e continua assim quando a escala é refeita)', async ({ page }) => {
    await abrirComExemplo(page);
    await abrirEscala(page);
    const botao = page.locator('#out tr.win').first().locator('button');
    const voos = w => page.locator(`#out tbody tr[data-w="${w}"]:not(.win)`);
    await expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(await voos(0).count()).toBeGreaterThan(0);
    await botao.click();
    await expect(page.locator('#out tr.win').first().locator('button')).toHaveAttribute('aria-expanded', 'false');
    await expect(voos(0).first()).toBeHidden();
    expect(await voos(0).evaluateAll(trs => trs.every(tr => tr.hidden))).toBe(true);
    await expect(voos(1).first()).toBeVisible();

    await page.locator('#s-esc [data-tl="eq"]').click();
    await page.locator('#s-esc [data-tl="lista"]').click();
    await expect(page.locator('#out tr.win').first().locator('button')).toHaveAttribute('aria-expanded', 'false');
    await expect(voos(0).first()).toBeHidden();
    await page.locator('#out tr.win').first().locator('button').click();
    await expect(voos(0).first()).toBeVisible();
  });

  test('cada alteração mostra a hora em que a escala foi refeita', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page.locator('#escala-atualizada')).toBeHidden();
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await irPara(page, 'esc');
    // Discreta, com um relógio, ao lado do título (e não na barra)
    const atualizada = page.locator('#s-esc h2 #escala-atualizada');
    await expect(atualizada).toHaveText('Atualizada às 12:00');
    await expect(atualizada.locator('use')).toHaveAttribute('href', '#i-relogio');
    await expect(page.locator('#s-esc .bar #escala-atualizada')).toHaveCount(0);
    expect(await atualizada.evaluate(el => getComputedStyle(el).fontSize)).toBe('13px');
  });
});
