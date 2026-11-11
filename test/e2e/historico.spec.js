// Histórico da data numa gaveta lateral, que abre sobre a aba aberta (sem trocar de aba).
import { test, expect, abrirSintetico, abrirComExemplo, irPara } from './fixtures.js';

test.describe('Histórico', () => {
  test('abre numa gaveta sobre a aba aberta, sem trocar de aba; Esc e ✕ fecham', async ({ page }) => {
    await abrirSintetico(page);
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect(page.locator('#log-cnt')).toHaveText('1');

    await page.locator('#btn-open-log').click();
    await expect(page.locator('#historico')).toBeVisible();
    await expect(page.locator('#s-rec')).toBeVisible();
    await expect(page.locator('#historico-data')).toHaveText('quarta-feira, 11/11');
    await expect(page.locator('#audit-log-list')).toContainText('PR-BTB: Manutenção');

    await page.keyboard.press('Escape');
    await expect(page.locator('#historico')).toBeHidden();
    await page.locator('#btn-open-log').click();
    await page.locator('#btn-fechar-historico').click();
    await expect(page.locator('#historico')).toBeHidden();
  });

  test('sem a lista "Inclusões na Escala": a tabela da escala já tem a ação de tirar o voo', async ({ page }) => {
    await abrirComExemplo(page);
    await expect(page.locator('#audit-panel, #inc-active-list')).toHaveCount(0);
    await expect(page.locator('#out [data-act="rm-fly"]').first()).toBeAttached();
  });
});
