// Verificação do site publicado com login real. Não altera os dados, exceto pela conversão única dos documentos da
// fase 2 no primeiro acesso de um operador (rode com --workers=1: o operador entra antes do gestor).
// Roda só quando as senhas das contas estão no ambiente; os demais testes E2E usam o modo local.
//   BASE_URL=https://thephfernandes.github.io/ACPM/ ACPM_SENHA_OPERADOR=... ACPM_SENHA_GESTOR=... \
//     npx playwright test test/e2e/publicado.spec.js
import { test, expect, AMANHA } from './fixtures.js';

const CONTAS = {
  operador: { email: process.env.ACPM_EMAIL_OPERADOR || 'operador.previa@example.com', senha: process.env.ACPM_SENHA_OPERADOR, rotulo: 'Operador' },
  gestor: { email: process.env.ACPM_EMAIL_GESTOR || 'gestor.previa@example.com', senha: process.env.ACPM_SENHA_GESTOR, rotulo: 'Gestor' }
};

test.describe('Site publicado (login real)', () => {
  test.skip(!process.env.ACPM_SENHA_OPERADOR || !process.env.ACPM_SENHA_GESTOR, 'defina BASE_URL, ACPM_SENHA_OPERADOR e ACPM_SENHA_GESTOR');

  for (const [perfil, conta] of Object.entries(CONTAS)) {
    test(`${perfil} entra e vê a escala compartilhada`, async ({ page }) => {
      await page.goto('./');
      await page.locator('#login-email').fill(conta.email);
      await page.locator('#login-senha').fill(conta.senha);
      await page.locator('#btn-entrar').click();
      await expect(page.locator('#usuario')).toContainText(`· ${conta.rotulo}`);
      await expect(page.locator('body')).toHaveAttribute('data-role', perfil);
      await expect(page.locator('#inst .cd').first()).toBeAttached();
      await page.locator('#btn-sair').click();
      await expect(page.locator('#form-login')).toBeVisible();
    });
  }

  test('gestor abre uma data sem escala: vê a cópia do dia anterior, sem gravar', async ({ page }) => {
    const conta = CONTAS.gestor;
    await page.goto('./');
    await page.locator('#login-email').fill(conta.email);
    await page.locator('#login-senha').fill(conta.senha);
    await page.locator('#btn-entrar').click();
    await expect(page.locator('#inst .cd').first()).toBeAttached();
    await expect(page.locator('#dt')).toHaveValue(AMANHA);
    const instrutores = await page.locator('#inst .cd').count();
    await page.locator('#nav button[data-t="esc"]').click();
    await page.locator('#dt').fill('2099-01-01');
    await page.locator('#dt').dispatchEvent('change');
    // A data base do BI só muda quando a nova data termina de carregar
    await expect(page.locator('#bi-dt')).toHaveValue('2099-01-01');
    await expect(page.locator('#out')).toContainText('Ainda não há escala para esta data');
    await expect(page.locator('#inst .cd')).toHaveCount(instrutores);
    await page.locator('#btn-sair').click();
  });
});
