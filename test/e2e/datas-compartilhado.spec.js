// Escala por data no modo compartilhado: migração dos documentos da fase 2 no servidor, gestor navegando
// entre as datas sem gravar e autor das alterações no histórico.
import { test, expect, irPara, AMANHA } from './fixtures.js';
import { instalarSupabaseFalso, documentosFase3, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';
import { aluno } from '../helpers/montar.js';
import { runAllocationEngine } from '../../js/engine.js';
import { ApiClient } from '../../js/storage.js';
import { separar } from '../../js/dias.js';

const URL_APP = './?supabase=teste';
const DEPOIS = '2026-11-12';

async function entrar(page, conta) {
  await page.goto(URL_APP);
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(conta.senha);
  await page.locator('#btn-entrar').click();
  await expect(page.locator('#usuario')).toBeVisible();
  await expect(page.locator('#wins input[data-a="win"]').first()).toBeAttached();
}

// O campo de data fica na aba 5 · Escala
async function mudarData(page, data) {
  await page.locator('#nav button[data-t="esc"]').click();
  await page.locator('#dt').fill(data);
  await page.locator('#dt').dispatchEvent('change');
  await expect(page.locator('#dt')).toHaveValue(data);
}

test.describe('Escala por data (modo compartilhado)', () => {
  test('no primeiro acesso de um operador, os documentos da fase 2 viram o formato por data', async ({ page, context }) => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000), aluno(1001, { p1: 2 })] });
    const escala = runAllocationEngine(estado);
    const servidor = await instalarSupabaseFalso(context, {
      documentos: {
        estado,
        escala,
        historico: [{ id: Date.UTC(2026, 10, 10, 13), ts: '10:00:00', type: 'mod', desc: 'Alteração antiga', revert: null }],
        bi: { '2026-11-03': { out: escala.out, tot: 2, rej: 0 }, [AMANHA]: { out: escala.out, tot: 2, rej: 0 } }
      }
    });
    await entrar(page, CONTAS.operador);

    await expect(page.locator('#dt')).toHaveValue(AMANHA);
    await irPara(page, 'esc');
    await expect(page.locator('#out table tbody tr')).not.toHaveCount(0);
    await expect(page.locator('#audit-log-list')).toContainText('Alteração antiga');
    await expect(page.locator('#audit-log-list')).toContainText('importado');
    expect(servidor.banco.get('cadastro').conteudo).toEqual(separar(estado).cadastro);
    expect([...servidor.dias.keys()].sort()).toEqual(['2026-11-03', AMANHA]);
    expect(servidor.historico.map(h => [h.descricao, h.importado])).toEqual([['Alteração antiga', true]]);
    expect(servidor.banco.has('estado'), 'os documentos da fase 2 ficam como cópia').toBe(true);
  });

  test('gestor navega entre as datas, sem gravar nada', async ({ page, context }) => {
    const estado = ApiClient.normalizeAndMigrateState({ ...estadoSintetico(), stu: [aluno(1000)] });
    const { documentos, dias } = documentosFase3(estado, AMANHA);
    const outroDia = structuredClone(dias[AMANHA]);
    outroDia.av['PR-BTB'] = false;
    const servidor = await instalarSupabaseFalso(context, { documentos, dias: { ...dias, [DEPOIS]: outroDia } });

    await entrar(page, CONTAS.gestor);
    await expect(page.locator('#dt')).toBeEnabled();
    await expect(page.locator('#eqs input[data-id="PR-BTB"]')).toBeChecked();
    await mudarData(page, DEPOIS);
    await expect(page.locator('#eqs input[data-id="PR-BTB"]')).not.toBeChecked();
    expect(servidor.gravacoes).toEqual([]);
    expect(servidor.historico).toEqual([]);
  });

  test('alteração feita enquanto outra data carrega fica na data que estava aberta', async ({ page, context }) => {
    const servidor = await instalarSupabaseFalso(context, documentosFase3(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.operador);
    const liberar = servidor.segurarLeiturasDeDias();
    await mudarData(page, DEPOIS);
    await irPara(page, 'rec');
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect.poll(() => servidor.gravacoes.length).toBe(1);
    expect(servidor.gravacoes.map(g => g.chave)).toEqual([`dia:${AMANHA}`]);
    liberar();
    await expect(page.locator('#log-cnt')).toHaveText('0');
    expect(servidor.dias.get(AMANHA).conteudo.av['PR-BTB']).toBe(false);
    expect(servidor.dias.has(DEPOIS)).toBe(false);
    expect(servidor.historico.map(h => [h.data, h.descricao])).toEqual([[AMANHA, 'PR-BTB: Manutenção']]);
  });

  test('o histórico mostra quem fez cada alteração', async ({ page, context }) => {
    await instalarSupabaseFalso(context, documentosFase3(estadoSintetico(), AMANHA));
    await entrar(page, CONTAS.operador);
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await page.reload();
    await expect(page.locator('#wins input[data-a="win"]').first()).toBeAttached();
    await expect(page.locator('#audit-log-list')).toContainText('Operador de Teste');
    await expect(page.locator('#audit-log-list')).toContainText('PR-BTB: Manutenção');
  });
});
