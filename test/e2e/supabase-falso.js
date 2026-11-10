// Servidor Supabase falso para os testes E2E, atendido por rotas do Playwright (sem rede).
// Segue o contrato do banco real (supabase/tests/database): login por e-mail e senha, perfil por conta,
// documentos com versão e salvar_documento respondendo 409 (PT409) em conflito e 403 sem perfil de operador.
export const URL_TESTE = 'https://acpm-teste.supabase.invalid';

export const CONTAS = {
  operador: { email: 'operador@teste.acpm', senha: 'senha-do-operador', id: '00000000-0000-4000-a000-000000000001', perfil: 'operador', nome: 'Operador de Teste' },
  gestor: { email: 'gestor@teste.acpm', senha: 'senha-do-gestor', id: '00000000-0000-4000-a000-000000000002', perfil: 'gestor', nome: 'Gestor de Teste' },
  semPerfil: { email: 'sem-perfil@teste.acpm', senha: 'senha-sem-perfil', id: '00000000-0000-4000-a000-000000000003', perfil: null, nome: '' }
};

const base64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const usuario = conta => ({
  id: conta.id, aud: 'authenticated', role: 'authenticated', email: conta.email,
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
  created_at: '2026-11-10T12:00:00Z', updated_at: '2026-11-10T12:00:00Z'
});

// Um servidor pode atender vários contextos do navegador (ex.: operador e gestor vendo os mesmos dados)
export function criarSupabaseFalso({ documentos = {} } = {}) {
  const banco = new Map(Object.entries(documentos).map(([chave, conteudo]) => [chave, { conteudo, versao: 1 }]));
  const sessoes = new Map();
  const gravacoes = [];
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  let falhasDeGravacao = 0;

  const atender = async route => {
    const req = route.request();
    const url = new URL(req.url());
    const responder = (status, corpo) => route.fulfill({
      status, headers: { ...cors, 'Content-Type': 'application/json' }, body: corpo === undefined ? '' : JSON.stringify(corpo)
    });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const conta = sessoes.get((req.headers().authorization || '').replace(/^Bearer /, ''));

    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const { email, password } = req.postDataJSON();
      const alvo = Object.values(CONTAS).find(c => c.email === email && c.senha === password);
      if (!alvo) return responder(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;  // longe no futuro: o relógio da página é fixo
      const token = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: alvo.id, email: alvo.email, role: 'authenticated', aud: 'authenticated', exp })}.assinatura`;
      sessoes.set(token, alvo);
      return responder(200, { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `renovar-${alvo.id}`, user: usuario(alvo) });
    }
    if (url.pathname === '/auth/v1/user') return conta ? responder(200, usuario(conta)) : responder(401, { code: 401, msg: 'invalid JWT' });
    if (url.pathname === '/auth/v1/logout') {
      sessoes.delete((req.headers().authorization || '').replace(/^Bearer /, ''));
      return route.fulfill({ status: 204, headers: cors });
    }

    if (url.pathname === '/rest/v1/perfis' && req.method() === 'GET') {
      return responder(200, conta && conta.perfil ? [{ perfil: conta.perfil, nome: conta.nome }] : []);
    }
    if (url.pathname === '/rest/v1/documentos' && req.method() === 'GET') {
      if (!conta || !conta.perfil) return responder(200, []);
      const chave = (url.searchParams.get('chave') || '').replace(/^eq\./, '');
      const doc = banco.get(chave);
      return responder(200, doc ? [{ conteudo: doc.conteudo, versao: doc.versao }] : []);
    }
    if (url.pathname === '/rest/v1/rpc/salvar_documento' && req.method() === 'POST') {
      const { p_chave, p_conteudo, p_versao_lida } = req.postDataJSON();
      gravacoes.push({ chave: p_chave, versaoLida: p_versao_lida, por: conta && conta.email });
      if (falhasDeGravacao > 0) {
        falhasDeGravacao--;
        return responder(503, { message: 'Service Unavailable' });
      }
      if (!conta || conta.perfil !== 'operador') return responder(403, { code: '42501', message: 'somente operadores podem alterar a escala' });
      const atual = banco.get(p_chave);
      const versaoAtual = atual ? atual.versao : 0;
      if (p_versao_lida !== versaoAtual) return responder(409, { code: 'PT409', message: `o documento ${p_chave} foi alterado por outra pessoa` });
      banco.set(p_chave, { conteudo: p_conteudo, versao: versaoAtual + 1 });
      return responder(200, versaoAtual + 1);
    }
    return responder(404, { message: `rota não simulada: ${req.method()} ${url.pathname}` });
  };

  return {
    banco,
    gravacoes,
    instalar: context => context.route(`${URL_TESTE}/**`, atender),
    // Simula indisponibilidade do servidor nas próximas gravações
    falharGravacoes(n) { falhasDeGravacao = n; },
    // Simula a gravação de outra pessoa (para testar conflitos)
    alterarPorOutraPessoa(chave, conteudo) {
      const atual = banco.get(chave);
      banco.set(chave, { conteudo, versao: (atual ? atual.versao : 0) + 1 });
    }
  };
}

export async function instalarSupabaseFalso(context, opcoes) {
  const servidor = criarSupabaseFalso(opcoes);
  await servidor.instalar(context);
  return servidor;
}
