import { readFile } from 'node:fs/promises';
import { test, expect, abrirSintetico, irPara, preencherExemplo, gerarEscala, lerEscala, json, AMANHA } from './fixtures.js';

test.describe('Escala', () => {
  test.beforeEach(async ({ page }) => {
    await abrirSintetico(page);
    await preencherExemplo(page);
    await gerarEscala(page);
  });

  test('gera a escala do exemplo: resumo, alertas, tabela e mapa por aeronave', async ({ page }) => {
    await expect(page.locator('#dt')).toHaveValue(AMANHA);
    expect(json(await lerEscala(page))).toMatchSnapshot('escala-exemplo.json');
  });

  test('mapa de ocupação por instrutor', async ({ page }) => {
    await page.locator('[data-tl="ins"]').click();
    await expect(page.locator('[data-tl="ins"]')).toHaveClass(/\bon\b/);
    expect(json((await lerEscala(page)).mapa)).toMatchSnapshot('mapa-por-instrutor.json');
  });

  test('filtra por equipamento e por texto', async ({ page }) => {
    await page.locator('#flt-esc-eq').selectOption('PR-VOM');
    const porEquipamento = await lerEscala(page);
    await page.locator('#flt-esc-eq').selectOption('');
    await page.locator('#flt-esc-q').fill('ground');
    const porTexto = await lerEscala(page);
    expect(json({ porEquipamento: porEquipamento.linhas, porTexto: porTexto.linhas })).toMatchSnapshot('escala-filtrada.json');
  });

  test('cancelar um voo atualiza status, horas e histórico', async ({ page }) => {
    const antes = await lerEscala(page);
    const ultimo = page.locator('#out table .st-sel').last();
    await ultimo.selectOption('Cancelado');
    await expect(page.locator('#out table tbody tr.st-Cancelado')).toHaveCount(1);
    const depois = await lerEscala(page);
    expect(json({ antes: antes.resumo, depois: depois.resumo, linha: depois.linhas.at(-1) })).toMatchSnapshot('cancelamento.json');
    await expect(page.locator('#audit-log-list')).toContainText(': Cancelado');
  });

  test('excluir da escala e restaurar pelo histórico', async ({ page }) => {
    const antes = await lerEscala(page);
    await page.locator('#out table [data-act="rm-fly"]').last().click();
    expect(json((await lerEscala(page)).resumo)).toMatchSnapshot('exclusao-resumo.json');
    await page.locator('#btn-open-log').click();
    await page.locator('#audit-log-list [data-act="rev-log"]', { hasText: 'Restaurar' }).first().click();
    expect(await lerEscala(page)).toEqual(antes);
  });

  test('exporta CSV com BOM, separador ";" e quebras CRLF', async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').click()]);
    expect(download.suggestedFilename()).toBe(`escala-acpm-${AMANHA}.csv`);
    const conteudo = await readFile(await download.path(), 'utf8');
    expect(conteudo[0]).toBe('﻿');
    expect(conteudo).not.toMatch(/[^\r]\n/);
    expect(conteudo.slice(1).split('\r\n').join('\n') + '\n').toMatchSnapshot('escala-exemplo.csv');
  });

  test('emite o PDF da escala com título, quadros e mais de uma página', async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#pdf').click()]);
    expect(download.suggestedFilename()).toBe(`escala-acpm-${AMANHA}.pdf`);
    const pdf = await readFile(await download.path());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // O jsPDF grava o conteúdo sem compressão: os textos ASCII aparecem literalmente no arquivo
    const conteudo = pdf.toString('latin1');
    for (const trecho of ['Escala de Voo - ACPM', 'Data da escala: 11/11/2026', 'Quadro por instrutor',
      'Quadro por equipamento / sala', 'Aluno 01', 'Instrutor 10', 'SALA-GROUND', 'PR-JPL']) {
      expect(conteudo, trecho).toContain(trecho);
    }
    expect(conteudo.match(/\/Type \/Page\b(?!s)/g).length).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#msg')).toHaveText('PDF emitido.');
  });

  test('mantém a escala após recarregar a página', async ({ page }) => {
    const antes = await lerEscala(page);
    await page.reload();
    await irPara(page, 'esc');
    expect(await lerEscala(page)).toEqual(antes);
  });
});
