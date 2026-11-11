// Aba Agenda de Solicitações (modo local): calendário, prazo das 13:00, registro com "Registrado por", exceção da
// coordenação e cancelamento. O relógio dos testes está em 10/11/2026, 12:00 em São Paulo.
import { test, expect, abrir, irPara, abrirEscala, lerEscala } from './fixtures.js';
import { aluno, cenario } from '../helpers/montar.js';

const comAlunos = () => cenario({ stu: [aluno(1000), aluno(1001)] });

async function registrar(page, { aluno: nome = 'Aluno 1000', missao = 'Voo Local', janela = 'manha', horario = null, por = 'Maria', obs = '' } = {}) {
  await page.locator('#ag-aluno').selectOption({ label: nome });
  await page.locator('#ag-missao').selectOption(missao);
  await page.locator('#ag-janela').selectOption(janela);
  if (horario) await page.locator('#ag-horario').selectOption(horario);
  await page.locator('#ag-por').fill(por);
  await page.locator('#ag-obs').fill(obs);
  await page.locator('#form-agenda [type="submit"]').click();
}

test.describe('Agenda de Solicitações', () => {
  test('registra pedidos para amanhã (antes das 13:00) com quem anotou e a hora', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await expect(page.locator('#agenda-data')).toHaveText('quarta-feira, 11/11/2026');
    await expect(page.locator('#agenda-prazo')).toContainText('Pedidos para amanhã (11/11) até hoje às 13:00');

    await registrar(page, { obs: 'Prefere o PR-BTB' });
    const pedidos = page.locator('#agenda-lista tbody tr');
    await expect(pedidos).toHaveCount(1);
    await expect(pedidos.first()).toContainText('Aluno 1000');
    await expect(pedidos.first()).toContainText('Voo Local');
    await expect(pedidos.first()).toContainText('Manhã');
    await expect(pedidos.first()).toContainText('Maria');
    await expect(pedidos.first()).toContainText('10/11 12:00');
    await expect(pedidos.first()).toContainText('Prefere o PR-BTB');
    await expect(page.locator('#agenda-cal [data-dia="2026-11-11"] .qtd')).toHaveText('1');
    await expect(page.locator('#ag-por')).toHaveValue('Maria', { timeout: 1000 });

    await registrar(page, { aluno: 'Aluno 1001', missao: 'IFR', janela: 'horario', horario: '14:30', por: 'João' });
    await expect(pedidos).toHaveCount(2);
    await expect(pedidos.nth(1)).toContainText('às 14:30');
    await expect(page.locator('#agenda-cal [data-dia="2026-11-11"] .qtd')).toHaveText('2');
  });

  test('"Registrado por" é obrigatório', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await registrar(page, { por: '' });
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(0);
  });

  test('fora do prazo não registra; a exceção da coordenação registra marcado', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await page.locator('#agenda-cal [data-dia="2026-11-10"]').click();
    await expect(page.locator('#agenda-prazo')).toContainText('Prazo encerrado para 10/11');
    await expect(page.locator('#form-agenda [type="submit"]')).toBeDisabled();
    await page.locator('#ag-aluno').selectOption({ label: 'Aluno 1000' });
    await page.locator('#ag-por').fill('Coordenação');
    await page.locator('#ag-excecao').click();
    await expect(page.locator('#agenda-lista tbody tr')).toHaveCount(1);
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('Exceção da coordenação');
  });

  test('cancelar pede confirmação e o pedido continua na agenda como cancelado', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await registrar(page);
    const cancelar = page.locator('#agenda-lista [data-act="cancelar-pedido"]').first();
    await cancelar.click();
    await expect(cancelar).toHaveText('Confirmar cancelamento');
    await cancelar.click();
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('Cancelado por Maria');
    await expect(page.locator('#agenda-cal [data-dia="2026-11-11"] .qtd')).toHaveCount(0);
  });

  test('"Importar Solicitações da Agenda" põe os pedidos da data na demanda, prontos para a escala', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: [aluno(1000, { fly: false }), aluno(1001, { fly: false })] }) });
    await irPara(page, 'age');
    await registrar(page, { aluno: 'Aluno 1000', janela: 'tarde' });
    await registrar(page, { aluno: 'Aluno 1001', missao: 'IFR', janela: 'horario', horario: '14:30' });

    await irPara(page, 'dem');
    await page.locator('#importar-agenda').click();
    const linha = id => page.locator(`#dem tr[data-k="d"][data-id="${id}"][data-mid="0"]`);
    await expect(linha(1000).locator('[data-f="fly"]')).toBeChecked();
    await expect(linha(1000).locator('[data-f="jan"]')).toHaveValue('tarde');
    await expect(linha(1001).locator('[data-f="mis"]')).toHaveValue('IFR');
    await expect(linha(1001).locator('[data-f="jan"]')).toHaveValue('h6');
    await expect(page.locator('#audit-log-list')).toContainText('Agenda: Aluno 1000 incluído (Voo Local · Tarde)');

    await page.locator('#importar-agenda').click();
    await expect(page.locator('#toast-box')).toContainText('Nenhum pedido novo na agenda para 11/11.');

    await abrirEscala(page);
    const voos = (await lerEscala(page)).linhas.filter(l => /Aluno 100[01]/.test(l));
    expect(voos.find(l => l.includes('Aluno 1000'))).toMatch(/^(12:40|13:40|14:30|16:20)/);
    expect(voos.find(l => l.includes('Aluno 1001'))).toMatch(/^14:30/);
  });

  test('depois das 13:00, amanhã fecha e a agenda abre no dia seguinte', async ({ page, context }) => {
    await context.clock.setFixedTime(new Date('2026-11-10T13:30:00-03:00'));
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await expect(page.locator('#agenda-data')).toHaveText('quinta-feira, 12/11/2026');
    await expect(page.locator('#agenda-prazo')).toContainText('Prazo para amanhã (11/11) encerrado às 13:00');
  });
});
