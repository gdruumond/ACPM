import { test, expect, prepararContexto, vigiarErros, irPara, preencherExemplo, gerarEscala, lerEscala, AMANHA } from './fixtures.js';
import { criarSupabaseFalso, instalarSupabaseFalso, CONTAS } from './supabase-falso.js';
import { estadoSintetico } from '../helpers/estado.js';

const URL_APP = './?supabase=teste';

async function entrar(page, conta, url = URL_APP) {
  await page.goto(url);
  await page.locator('#login-email').fill(conta.email);
  await page.locator('#login-senha').fill(conta.senha);
  await page.locator('#btn-entrar').click();
  await expect(page.locator('#usuario')).toBeVisible();
  // Espera os dados do servidor serem carregados (os instrutores aparecem depois da leitura)
  await expect(page.locator('#inst .cd').first()).toBeAttached();
}

async function novoContexto(browser) {
  const contexto = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await prepararContexto(contexto);
  return contexto;
}

test.describe('Modo compartilhado: gravação, conflitos e link da escala', () => {
  test('conflito: aviso fixo, nada mais é enviado e "Recarregar" mostra a versão do colega', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, { documentos: { estado: estadoSintetico() } });
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [409] });
    await entrar(page, CONTAS.operador);

    const doColega = estadoSintetico();
    doColega.ins[0].nm = 'Instrutor do Colega';
    servidor.alterarPorOutraPessoa('estado', doColega);
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect(page.locator('#aviso-sync')).toBeVisible();
    await expect(page.locator('#aviso-sync')).toContainText('Outra pessoa alterou a escala');

    await page.waitForTimeout(300);
    const enviadas = servidor.gravacoes.length;
    await page.locator('#eqs input[data-id="PR-IGU"]').uncheck();
    await page.waitForTimeout(300);
    expect(servidor.gravacoes.length, 'depois do conflito nada mais é enviado').toBe(enviadas);

    await page.locator('#btn-recarregar').click();
    await expect(page.locator('#usuario')).toBeVisible();
    await expect(page.locator('#aviso-sync')).toBeHidden();
    await irPara(page, 'ins');
    await expect(page.locator('#inst .cd .nm').first()).toHaveValue('Instrutor do Colega');
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('servidor fora do ar: aviso de erro, que some quando a gravação volta a funcionar', async ({ browser }) => {
    const contexto = await novoContexto(browser);
    const servidor = await instalarSupabaseFalso(contexto, { documentos: { estado: estadoSintetico() } });
    const page = await contexto.newPage();
    const erros = vigiarErros(page, { statusEsperados: [503] });
    await entrar(page, CONTAS.operador);

    servidor.falharGravacoes(2);
    await page.locator('#eqs input[data-id="PR-BTB"]').uncheck();
    await expect(page.locator('#aviso-sync')).toContainText('Não foi possível salvar');
    await page.locator('#eqs input[data-id="PR-IGU"]').uncheck();
    await expect(page.locator('#aviso-sync')).toBeHidden();
    await expect.poll(() => servidor.banco.get('estado').conteudo.av['PR-IGU']).toBe(false);
    expect(servidor.banco.get('estado').conteudo.av['PR-BTB']).toBe(false);
    expect(erros).toEqual([]);
    await contexto.close();
  });

  test('a escala gerada guarda a data, o link leva só a data e o gestor vê a mesma escala', async ({ browser }) => {
    const servidor = criarSupabaseFalso({ documentos: { estado: estadoSintetico() } });

    const operador = await novoContexto(browser);
    await servidor.instalar(operador);
    const pgOperador = await operador.newPage();
    await entrar(pgOperador, CONTAS.operador);
    await preencherExemplo(pgOperador);
    await gerarEscala(pgOperador);
    await expect.poll(() => servidor.banco.get('escala') && servidor.banco.get('escala').conteudo.data).toBe(AMANHA);
    const escalaOperador = await lerEscala(pgOperador);
    await pgOperador.locator('#btn-share-link').click();
    const link = await pgOperador.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get('data')).toBe(AMANHA);
    expect(link).not.toContain('share=');

    const gestor = await novoContexto(browser);
    await servidor.instalar(gestor);
    const pgGestor = await gestor.newPage();
    const erros = vigiarErros(pgGestor);
    await entrar(pgGestor, CONTAS.gestor, link);
    await expect(pgGestor.locator('#dt')).toHaveValue(AMANHA);
    await irPara(pgGestor, 'esc');
    const escalaGestor = await lerEscala(pgGestor);
    expect(escalaGestor.linhas).toEqual(escalaOperador.linhas);
    expect(escalaGestor.resumo).toEqual(escalaOperador.resumo);
    expect(erros).toEqual([]);
    await operador.close();
    await gestor.close();
  });

  test('link antigo com os dados na URL (share=) é ignorado depois do login', async ({ page, context }) => {
    await instalarSupabaseFalso(context, { documentos: { estado: estadoSintetico() } });
    const payload = { d: AMANHA, fly: [[1000, 'Aluno do Link', 70, [], 1, 'Voo Local', 'C152', 1, 2, 1, 1, 3, []]] };
    const share = encodeURIComponent(Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'));
    await entrar(page, CONTAS.operador, `${URL_APP}&share=${share}`);
    await expect(page.locator('body')).toHaveAttribute('data-role', 'operador');
    await expect(page.locator('body')).not.toHaveAttribute('data-shared', 'true');
    await irPara(page, 'alu');
    await expect(page.locator('#alu .cd')).toHaveCount(0);
  });
});
