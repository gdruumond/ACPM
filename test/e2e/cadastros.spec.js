import { test, expect, abrir, abrirSintetico, irPara } from './fixtures.js';

test.describe('Recursos', () => {
  test('estado inicial: 9 janelas, 26 recursos, nenhum instrutor e nenhum aluno', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#wins input[data-a="win"]')).toHaveCount(9);
    await expect(page.locator('#wins label').last()).toHaveText('9º · 17:30 (noturno)');
    await expect(page.locator('#eqs input[data-a="av"]')).toHaveCount(26);
    await expect(page.locator('#eqs h2')).toHaveText(['Sim. Mono', 'Sim. Multi', 'C152', 'C172', 'PA-34']);
    await expect(page.locator('#eqs label:has(input[data-id="PR-JPL"])')).toContainText('Acrobat · Parafuso');
    await expect(page.locator('#inst .cd')).toHaveCount(0);
    await expect(page.locator('#inst')).toContainText('Nenhum instrutor cadastrado');
    await irPara(page, 'alu');
    await expect(page.locator('#alu')).toContainText('Nenhum aluno cadastrado');
  });

  test('aeronave em manutenção fica registrada no histórico e persiste', async ({ page }) => {
    await abrirSintetico(page);
    const chip = page.locator('#eqs label:has(input[data-id="PR-BTB"])');
    await chip.locator('input').uncheck();
    await expect(chip).toHaveClass(/\boff\b/);
    await expect(page.locator('#log-cnt')).toHaveText('1');
    await expect(page.locator('#audit-log-list')).toContainText('PR-BTB: Manutenção');
    await page.reload();
    await expect(page.locator('#eqs input[data-id="PR-BTB"]')).not.toBeChecked();
    await expect(page.locator('#log-cnt')).toHaveText('1');
  });

  test('desativa uma janela de operação', async ({ page }) => {
    await abrirSintetico(page);
    const janela = page.locator('#wins label').nth(3);
    await janela.locator('input').uncheck();
    await expect(janela).toHaveClass(/\boff\b/);
    await expect(page.locator('#audit-log-list')).toContainText('Janela 11:30 inativa');
  });
});

test.describe('Instrutores', () => {
  test('filtra por nome e por nível mínimo', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'ins');
    await page.locator('[data-flt="inst"]').fill('instrutor 1');
    await expect(page.locator('#inst .cd:visible')).toHaveCount(10);
    await page.locator('[data-flt="inst"]').fill('');
    await page.locator('#flt-ins-lv').selectOption('9');
    await expect(page.locator('#inst .cd:visible')).toHaveCount(4);
    await expect(page.locator('#inst .cd:visible .nm').first()).toHaveValue('Instrutor 09');
  });

  test('cadastra instrutor e altera nível, peso e turno', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'ins');
    await page.locator('[data-act="addi"]').click();
    const card = page.locator('#inst .cd').last();
    await expect(page.locator('#inst .cd')).toHaveCount(41);
    await expect(card.locator('.nm')).toHaveValue('Novo instrutor');
    await card.locator('[data-f="lv"]').selectOption('7');
    await expect(page.locator('#inst .cd').last()).toHaveAttribute('data-lv', '7');
    await page.locator('#inst .cd').last().locator('[data-f="kg"]').fill('80');
    await page.locator('#inst .cd').last().locator('[data-f="kg"]').blur();
    await page.locator('#inst .cd').last().locator('[data-f="pre"]').selectOption('Manhã');
    const janelas = page.locator('#inst .cd').last().locator('[data-f="aw"]');
    await expect(janelas).toHaveCount(9);
    for (let i = 0; i < 9; i++) {
      if (i < 4) await expect(janelas.nth(i)).toBeChecked();
      else await expect(janelas.nth(i)).not.toBeChecked();
    }
    await expect(page.locator('#audit-log-list')).toContainText('Peso Novo instrutor: 80 kg');
    await expect(page.locator('#audit-log-list')).toContainText('Nível Novo instrutor: A07');
  });

  test('instrutor indisponível pode ser revertido pelo histórico', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'ins');
    await page.locator('#inst .cd').first().locator('[data-f="on"]').uncheck();
    await expect(page.locator('#inst .cd').first()).toHaveClass(/\boff\b/);
    await page.locator('#btn-open-log').click();
    await page.locator('#audit-log-list [data-act="rev-log"]').first().click();
    await irPara(page, 'ins');
    await expect(page.locator('#inst .cd').first()).not.toHaveClass(/\boff\b/);
  });
});

test.describe('Alunos', () => {
  test('cadastra, bloqueia instrutor e exclui aluno com confirmação', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'alu');
    await page.locator('[data-act="adds"]').click();
    const card = page.locator('#alu .cd');
    await expect(card).toHaveCount(1);
    await expect(card.locator('.nm')).toHaveValue('Novo aluno');

    await card.locator('[data-f="bl"]').selectOption({ label: 'Instrutor 03' });
    await expect(page.locator('#alu .cd .tg')).toHaveText(/Instrutor 03/);
    await page.locator('#alu .cd [data-act="unbl"]').click();
    await expect(page.locator('#alu .cd .tg')).toHaveCount(0);

    await irPara(page, 'dem');
    await expect(page.locator('#dem tr[data-k="d"]')).toHaveCount(1);

    await irPara(page, 'alu');
    const excluir = page.locator('#alu .cd [data-act="dels"]');
    await excluir.click();
    await expect(excluir).toHaveText('Confirmar');
    await excluir.click();
    await expect(page.locator('#alu')).toContainText('Nenhum aluno cadastrado');
  });

  test('busca alunos pelo nome', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'alu');
    for (let i = 0; i < 3; i++) await page.locator('[data-act="adds"]').click();
    await page.locator('#alu .cd').nth(1).locator('.nm').fill('Carla');
    await page.locator('#alu .cd').nth(1).locator('.nm').blur();
    await page.locator('[data-flt="alu"]').fill('carla');
    await expect(page.locator('#alu .cd:visible')).toHaveCount(1);
  });
});
