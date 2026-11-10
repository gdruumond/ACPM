import { test, expect, abrirSintetico, irPara, preencherExemplo, json } from './fixtures.js';

const lerDemanda = page => page.locator('#dem tr[data-k="d"]').evaluateAll(linhas => linhas.map(tr => {
  const valor = f => {
    const el = tr.querySelector(`[data-f="${f}"]`);
    if (!el) return '';
    return el.type === 'checkbox' ? (el.checked ? 'voa' : '—') : el.value;
  };
  const texto = td => td.innerText.replace(/\s+/g, ' ').trim();
  return [texto(tr.cells[0]), valor('fly'), valor('mis'), valor('eq'), valor('p1'), valor('p2'), valor('nb'), valor('ss'), valor('pr'), texto(tr.cells[9])].join(' | ');
}));

const linhaDoAluno = (page, nome) => page.locator(`#dem tr[data-k="d"][data-mid="0"][data-nm="${nome.toLowerCase()}"]`);

test.describe('Demanda', () => {
  test('"Preencher exemplo" cria 20 alunos com as missões de exemplo', async ({ page }) => {
    await abrirSintetico(page);
    await preencherExemplo(page);
    await expect(page.locator('#dem tr[data-k="d"][data-mid="0"]')).toHaveCount(20);
    expect(json({ contagem: await page.locator('#cnt').innerText(), linhas: await lerDemanda(page) }))
      .toMatchSnapshot('demanda-exemplo.json');
  });

  test('"+ Missão" adiciona e remove uma missão extra do aluno', async ({ page }) => {
    await abrirSintetico(page);
    await preencherExemplo(page);
    await linhaDoAluno(page, 'Aluno 09').locator('[data-act="add-mis"]').click();
    const extra = page.locator('#dem tr.extra-row[data-nm="aluno 09"]');
    await expect(extra).toHaveCount(1);
    await expect(extra.locator('td').first()).toContainText('↳ Aluno 09 (missão extra)');
    await expect(extra.locator('[data-f="mis"]')).toHaveValue('Voo Local');
    await expect(extra.locator('[data-f="p1"]')).toHaveValue('4');
    await extra.locator('[data-act="del-mis"]').click();
    await expect(extra).toHaveCount(0);
    await expect(page.locator('#audit-log-list')).toContainText('Missão extra removida de Aluno 09');
  });

  test('trocar a missão ajusta equipamento, duração e horários', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'alu');
    await page.locator('[data-act="adds"]').click();
    await irPara(page, 'dem');
    const linha = page.locator('#dem tr[data-k="d"]');
    const valores = async () => Object.fromEntries(await Promise.all(
      ['eq', 'p1', 'p2', 'nb'].map(async f => [f, await linha.locator(`[data-f="${f}"]`).inputValue()])
    ));

    await linha.locator('[data-f="mis"]').selectOption('Noturno');
    expect(await valores()).toEqual({ eq: 'C172', p1: '8', p2: '8', nb: '1' });

    await linha.locator('[data-f="mis"]').selectOption('Ground C152');
    expect(await valores()).toEqual({ eq: 'Sala Ground', p1: '0', p2: '1', nb: '1.5' });
    await expect(linha.locator('[data-f="eq"]')).toBeDisabled();
    await expect(linha.locator('td').last()).toHaveText('');

    await linha.locator('[data-f="fly"]').check();
    await expect(linha.locator('td').last()).toHaveText('06:30–08:00 · 01h30 · Instrutor A01+ · Turma coletiva');

    await linha.locator('[data-f="mis"]').selectOption('Voo Local');
    expect(await valores()).toEqual({ eq: 'C152', p1: '0', p2: '1', nb: '1' });
  });

  test('filtros "Só quem voa", nome e missão', async ({ page }) => {
    await abrirSintetico(page);
    await preencherExemplo(page);
    const visiveis = page.locator('#dem tr[data-k="d"]:visible');

    await page.locator('#onlyfly').check();
    await expect(page.locator('#dem')).toHaveClass(/\bonly\b/);
    await expect(visiveis).toHaveCount(await page.locator('#dem tr[data-k="d"].on').count());

    await page.locator('#flt-dem').fill('aluno 01');
    await expect(visiveis).toHaveCount(3);

    await page.locator('#flt-dem').fill('');
    await page.locator('#flt-dem-mis').selectOption('Ground C152');
    await expect(visiveis).toHaveCount(6);
  });

  test('"Desfazer" restaura a demanda anterior', async ({ page }) => {
    await abrirSintetico(page);
    await preencherExemplo(page);
    await expect(page.locator('#btn-undo')).toBeEnabled();
    await page.locator('#btn-undo').click();
    await expect(page.locator('#dem')).toContainText('Nenhum aluno cadastrado');
    await expect(page.locator('#btn-undo')).toBeDisabled();
    await expect(page.locator('#audit-log-list')).toContainText('Ação desfeita pelo botão Desfazer');
  });
});
