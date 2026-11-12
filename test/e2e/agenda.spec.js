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

  test('o horário específico oferece os horários da missão: o Multimotor (PA-34), de 30 em 30 minutos', async ({ page }) => {
    await abrir(page, { estado: comAlunos() });
    await irPara(page, 'age');
    await page.locator('#ag-janela').selectOption('horario');
    await expect(page.locator('#ag-horario option')).toHaveText(['06:30', '08:20', '10:10', '11:30', '12:40', '13:40', '14:30', '16:20']);
    await page.locator('#ag-missao').selectOption('Multimotor');
    await expect(page.locator('#ag-horario option')).toHaveCount(21);
    await registrar(page, { missao: 'Multimotor', janela: 'horario', horario: '07:30' });
    await expect(page.locator('#agenda-lista tbody tr').first()).toContainText('às 07:30');
    await page.locator('#ag-missao').selectOption('Noturno');
    await expect(page.locator('#ag-horario option')).toHaveText(['17:30']);
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
    const linha = page.locator('#agenda-lista tbody tr').first();
    await expect(linha.locator('.situacao')).toHaveText('Cancelado por Maria em 10/11 12:00');
    await expect(linha.locator('.situacao .tag')).toHaveAttribute('title', 'Cancelado por Maria em 10/11 12:00');
    await expect(page.locator('#agenda-cal [data-dia="2026-11-11"] .qtd')).toHaveCount(0);
    // Numa linha só, esmaecido
    await expect(linha).toHaveClass(/\bcancel\b/);
    expect(await linha.evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(50);
  });

  test('a coluna Situação diz se o pedido já está na demanda; o operador importa pela própria agenda', async ({ page }) => {
    await abrir(page, { estado: cenario({ stu: [aluno(1000, { fly: false }), aluno(1001, { fly: false })] }) });
    await irPara(page, 'age');
    await registrar(page, { aluno: 'Aluno 1000' });
    await registrar(page, { aluno: 'Aluno 1001', janela: 'tarde' });
    const situacao = page.locator('#agenda-lista tbody tr .situacao');
    await expect(situacao).toHaveText(['Ainda não importado', 'Ainda não importado']);
    const importar = page.locator('#agenda-importar');
    await expect(importar).toHaveText('Importar 2 pedidos para a demanda');
    await importar.click();
    await expect(situacao).toHaveText(['Na demanda', 'Na demanda']);
    await expect(importar).toBeHidden();
    await expect(page.locator('#selo-age')).toBeHidden();
    await irPara(page, 'dem');
    await expect(page.locator('#dem tr[data-k="d"][data-id="1001"] [data-f="fly"]')).toBeChecked();

    // Outra data (não é a aberta no topo): sem situação e sem importar
    await irPara(page, 'age');
    await page.locator('#agenda-cal [data-dia="2026-11-12"]').click();
    await registrar(page, { aluno: 'Aluno 1000' });
    await expect(situacao).toHaveText(['']);
    await expect(importar).toBeHidden();
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
    await expect(linha(1001).locator('[data-f="jan"]')).toHaveValue('h870');
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
