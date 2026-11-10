// Verificação do site publicado com login real (somente leitura: não altera os dados).
// Roda só quando as senhas das contas estão no ambiente; os demais testes E2E usam o modo local.
//   BASE_URL=https://thephfernandes.github.io/ACPM/ ACPM_SENHA_OPERADOR=... ACPM_SENHA_GESTOR=... \
//     npx playwright test test/e2e/publicado.spec.js
import { test, expect } from './fixtures.js';

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
});
