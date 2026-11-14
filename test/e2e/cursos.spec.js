// Cursos (fase 14): o programa de cada curso (PP, PC e INVA) fica em Alunos › Cursos. O Administrador inclui, muda,
// reordena e tira missões; os outros perfis só consultam. Cada aluno tem o curso dele.
import { test, expect, abrir, irPara, confirmar } from './fixtures.js';
import { aluno, cenario, instrutor } from '../helpers/montar.js';

const dia = (extra = {}) => ({ ...cenario({ ins: [instrutor(1, 9)], stu: [aluno(1000, {}, { curso: 'PP' }), aluno(1001)] }), ...extra });
const PROGRAMA = { PP: [{ id: 'PP-01', nome: 'Familiarização', mis: 'Voo Local', eq: 'C152', nb: 1 }, { id: 'PP-02', nome: 'Navegação', mis: 'Navegação', eq: 'C152', nb: 2 }], PC: [], INVA: [] };
const verCursos = async page => {
  await irPara(page, 'alu');
  await page.locator('#s-alu [data-vista-alu="cursos"]').click();
  await expect(page.locator('#cursos')).toBeVisible();
};
const curso = (page, id) => page.locator(`#cursos .curso[data-curso="${id}"]`);
const linhas = (page, id) => curso(page, id).locator('tbody tr[data-i]');

test.describe('Cursos', () => {
  test('o Administrador monta o programa: inclui, muda, reordena e tira missões; tudo fica gravado', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await verCursos(page);
    await expect(curso(page, 'PP')).toContainText('Nenhuma missão no programa');
    await curso(page, 'PP').getByRole('button', { name: '+ Missão' }).click();
    await curso(page, 'PP').getByRole('button', { name: '+ Missão' }).click();
    await expect(linhas(page, 'PP')).toHaveCount(2);
    await expect(linhas(page, 'PP').nth(1).locator('[data-cf="id"]')).toHaveValue('PP-02');
    await expect(linhas(page, 'PP').nth(1).locator('[data-cf="nome"]')).toBeFocused();

    await linhas(page, 'PP').nth(0).locator('[data-cf="nome"]').fill('Familiarização');
    await linhas(page, 'PP').nth(0).locator('[data-cf="nome"]').press('Tab');
    await linhas(page, 'PP').nth(1).locator('[data-cf="mis"]').selectOption('Navegação');
    await linhas(page, 'PP').nth(1).locator('[data-cf="nb"]').selectOption('2');
    await linhas(page, 'PP').nth(1).getByRole('button', { name: 'Subir PP-02' }).click();
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="id"]')).toHaveValue('PP-02');

    // Código repetido no curso não vale
    await linhas(page, 'PP').nth(0).locator('[data-cf="id"]').fill('pp-01');
    await linhas(page, 'PP').nth(0).locator('[data-cf="id"]').press('Tab');
    await expect(page.locator('#toast-box')).toContainText('O código PP-01 já existe no PP.');
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="id"]')).toHaveValue('PP-02');

    await confirmar(page, '#cursos .curso[data-curso="PP"] tbody tr[data-i="1"] [data-act="curso-remover"]');
    await expect(linhas(page, 'PP')).toHaveCount(1);
    await page.locator('#btn-open-log').click();
    await expect(page.locator('#audit-log-list')).toContainText('Programa do PP: PP-01 removida');
    await page.keyboard.press('Escape');

    await page.reload();
    await verCursos(page);
    await expect(linhas(page, 'PP')).toHaveCount(1);
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="mis"]')).toHaveValue('Navegação');
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="nb"]')).toHaveValue('2');
  });

  test('cada aluno tem o curso dele, na lista de alunos', async ({ page }) => {
    await abrir(page, { estado: dia() });
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr[data-id="1000"] [data-f="curso"]')).toHaveValue('PP');
    await page.locator('#alu tr[data-id="1001"] [data-f="curso"]').selectOption('INVA');
    await page.reload();
    await irPara(page, 'alu');
    await expect(page.locator('#alu tr[data-id="1001"] [data-f="curso"]')).toHaveValue('INVA');
  });

  test('no Gestor, o programa e o curso dos alunos só aparecem', async ({ page }) => {
    await abrir(page, { estado: dia({ cursos: PROGRAMA }), url: './?role=gestor' });
    await verCursos(page);
    await expect(linhas(page, 'PP')).toHaveCount(2);
    await expect(linhas(page, 'PP').nth(0).locator('[data-cf="nome"]')).toBeDisabled();
    await expect(curso(page, 'PP').getByRole('button', { name: '+ Missão' })).toBeHidden();
    await page.locator('#s-alu [data-vista-alu="alunos"]').click();
    await expect(page.locator('#alu tr[data-id="1000"] [data-f="curso"]')).toBeDisabled();
  });
});
