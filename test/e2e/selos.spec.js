// Selos de atenção nas abas: avisos da escala, aviões parados ou perto da revisão de 50 horas e pedidos da agenda
// que ainda não estão na demanda.
import { test, expect, abrir, irPara, AMANHA } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';
import { instalarSupabaseFalso, documentosAtuais, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';

async function entrar(page, conta) {
  await page.goto('./?supabase=teste');
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(conta.senha);
  await page.locator('#btn-entrar').click();
  await expect(page.locator('#usuario')).toBeVisible();
}

const pedido = (id, data = AMANHA) => ({
  id, data, aluno: 1000, aluno_nome: 'Aluno 1000', missao: 'Voo Local', janela: 'manha', horario: null, observacao: null,
  registrado_por: 'Maria', registrado_em: '2026-11-10T14:00:00.000Z', conta: 'Secretaria de Teste', excecao: false, cancelada_em: null, cancelada_por: null
});

test.describe('Selos nas abas', () => {
  test('Escala: o número de avisos, em âmbar', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: [aluno(1000, {}, { kg: 0 })] }) });
    await expect(page.locator('#selo-esc')).toHaveText('1');
    await expect(page.locator('#selo-esc')).toHaveClass(/\baviso\b/);
  });

  test('Escala: missões que não entraram vêm primeiro, em vermelho; sem nada a avisar, sem selo', async ({ page }) => {
    await abrir(page, { estado: cenario({ ins: [instrutor(1, 1)], stu: [aluno(1000, { mis: 'Multimotor', eq: 'PA-34' })] }) });
    await expect(page.locator('#selo-esc')).toHaveText('1');
    await expect(page.locator('#selo-esc')).toHaveClass(/\berro\b/);

    await irPara(page, 'dem');
    await page.locator('#dem tr[data-k="d"] [data-f="fly"]').uncheck();
    await expect(page.locator('#selo-esc')).toBeHidden();
  });

  test('Recursos: aviões parados ou com menos de 5 h até a revisão de 50 horas', async ({ page }) => {
    await abrir(page, { estado: cenario({ horas: { 'PR-BTB': 47, 'PR-IGU': 10 } }) });
    await expect(page.locator('#selo-rec')).toHaveText('1');
    await expect(page.locator('#selo-esc')).toBeHidden();
  });

  test('Agenda: pedidos da data que ainda não estão na demanda; somem depois de importar', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000), aluno(1001)] }, AMANHA));
    servidor.solicitacoes.push(pedido(1), pedido(2, '2026-11-12'));
    await entrar(page, CONTAS.operador);
    await expect(page.locator('#selo-age')).toHaveText('1');

    await irPara(page, 'dem');
    await page.locator('#importar-agenda').click();
    await expect(page.locator('#selo-age')).toBeHidden();
  });

  test('o Gestor não vê o selo da agenda (ele não importa pedidos)', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosAtuais({ ...estadoSintetico(), stu: [aluno(1000)] }, AMANHA));
    servidor.solicitacoes.push(pedido(1));
    await entrar(page, CONTAS.gestor);
    await expect(page.locator('#nav button[data-t="esc"]')).toHaveClass(/\bon\b/);
    await expect(page.locator('#selo-age')).toBeHidden();
  });
});
