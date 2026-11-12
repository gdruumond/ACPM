// Verificação do site publicado com login real. Não altera os dados, exceto pela conversão única dos documentos da
// fase 2 no primeiro acesso de um operador (rode com --workers=1: o operador entra antes do gestor).
// Roda só quando as senhas das contas estão no ambiente; os demais testes E2E usam o modo local.
//   BASE_URL=https://thephfernandes.github.io/ACPM/ ACPM_SENHA_OPERADOR=... ACPM_SENHA_GESTOR=... ACPM_SENHA_SECRETARIA=... ACPM_SENHA_ADMIN=... \
//     npx playwright test test/e2e/publicado.spec.js --workers=1
import { test, expect, abrirMenuDaConta, AMANHA } from './fixtures.js';

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
      await abrirMenuDaConta(page);
      await page.locator('#btn-sair').click();
      // Sair recarrega a página: na rede real, os módulos podem levar mais que o tempo padrão para carregar
      await expect(page.locator('#form-login')).toBeVisible({ timeout: 20000 });
    });
  }

  test('secretaria entra direto na agenda de solicitações (a escala ela só consulta)', async ({ page }) => {
    test.skip(!process.env.ACPM_SENHA_SECRETARIA, 'defina ACPM_SENHA_SECRETARIA');
    await page.goto('./');
    await page.locator('#login-email').fill(process.env.ACPM_EMAIL_SECRETARIA || 'secretaria.previa@example.com');
    await page.locator('#login-senha').fill(process.env.ACPM_SENHA_SECRETARIA);
    await page.locator('#btn-entrar').click();
    await expect(page.locator('#usuario')).toContainText('· Secretaria');
    await expect(page.locator('#s-age')).toBeVisible();
    await expect(page.locator('#form-agenda')).toBeVisible();
    await expect(page.locator('#ag-aluno option')).not.toHaveCount(0);
    await expect(page.locator('#agenda-prazo')).not.toBeEmpty();
    await abrirMenuDaConta(page);
    await page.locator('#btn-sair').click();
  });

  test('administrador vê as contas em Minha conta › Usuários', async ({ page }) => {
    test.skip(!process.env.ACPM_SENHA_ADMIN, 'defina ACPM_SENHA_ADMIN');
    await page.goto('./');
    await page.locator('#login-email').fill(process.env.ACPM_EMAIL_ADMIN || 'admin.previa@example.com');
    await page.locator('#login-senha').fill(process.env.ACPM_SENHA_ADMIN);
    await page.locator('#btn-entrar').click();
    await expect(page.locator('#usuario')).toContainText('· Administrador');
    await abrirMenuDaConta(page);
    await page.locator('#btn-conta').click();
    await expect(page.locator('#usuarios')).toBeVisible();
    await expect(page.locator('#lista-contas tbody tr')).not.toHaveCount(0);
    await abrirMenuDaConta(page);
    await page.locator('#btn-sair').click();
  });

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
    // A data nova mostra a escala calculada com a demanda copiada do dia anterior (vazia se a prévia não tiver alunos)
    await expect(page.locator('#out')).toContainText(/Nenhum voo nesta data|missões pedidas/);
    await expect(page.locator('#inst .cd')).toHaveCount(instrutores);
    await abrirMenuDaConta(page);
    await page.locator('#btn-sair').click();
  });
});
