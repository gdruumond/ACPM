// Servidor Supabase falso para os testes E2E, atendido por rotas do Playwright (sem rede).
// Segue o contrato do banco real (supabase/tests/database): login por e-mail e senha, perfil por conta,
// documentos e escalas por data com versão (salvar_documento e salvar_dia respondem 409 / PT409 em conflito e
// 403 sem perfil de operador) e histórico que só cresce (registrar_historico e importar_historico).
import { separar } from '../../js/dias.js';
import { migrarCadastro, migrarDia } from '../../js/migracoes.js';

export const URL_TESTE = 'https://acpm-teste.supabase.invalid';

export const CONTAS = {
  operador: { email: 'operador@teste.acpm', senha: 'senha-do-operador', id: '00000000-0000-4000-a000-000000000001', perfil: 'operador', nome: 'Operador de Teste' },
  gestor: { email: 'gestor@teste.acpm', senha: 'senha-do-gestor', id: '00000000-0000-4000-a000-000000000002', perfil: 'gestor', nome: 'Gestor de Teste' },
  semPerfil: { email: 'sem-perfil@teste.acpm', senha: 'senha-sem-perfil', id: '00000000-0000-4000-a000-000000000003', perfil: null, nome: '' }
};

// Documentos no formato por data da fase 3 (sem a versão do formato) a partir de um estado da aplicação
export function documentosFase3(estado, data) {
  const { cadastro, dia } = separar(estado);
  return { documentos: { cadastro }, dias: { [data]: { ...dia, resultado: null } } };
}

// Os mesmos documentos no formato atual (o que o app grava hoje)
export function documentosAtuais(estado, data) {
  const { documentos, dias } = documentosFase3(estado, data);
  return { documentos: { cadastro: migrarCadastro(documentos.cadastro) }, dias: { [data]: migrarDia(dias[data]) } };
}

const base64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const usuario = conta => ({
  id: conta.id, aud: 'authenticated', role: 'authenticated', email: conta.email,
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
  created_at: '2026-11-10T12:00:00Z', updated_at: '2026-11-10T12:00:00Z'
});

// Filtros do PostgREST usados pelo app: coluna=eq.x, gte.x, lte.x, lt.x; order=coluna.asc|desc; limit=n
function consultar(linhas, url) {
  const operadores = { eq: (a, b) => a === b, gte: (a, b) => a >= b, lte: (a, b) => a <= b, lt: (a, b) => a < b };
  let resultado = linhas;
  for (const [coluna, valor] of url.searchParams) {
    if (['select', 'order', 'limit'].includes(coluna)) continue;
    const [op, ...resto] = valor.split('.');
    const alvo = resto.join('.');
    resultado = resultado.filter(l => operadores[op](String(l[coluna]), alvo));
  }
  const ordem = url.searchParams.get('order');
  if (ordem) {
    const [coluna, sentido] = ordem.split('.');
    resultado = [...resultado].sort((a, b) => (a[coluna] < b[coluna] ? -1 : a[coluna] > b[coluna] ? 1 : 0) * (sentido === 'desc' ? -1 : 1));
  }
  const limite = url.searchParams.get('limit');
  return limite ? resultado.slice(0, Number(limite)) : resultado;
}

// Um servidor pode atender vários contextos do navegador (ex.: operador e gestor vendo os mesmos dados)
export function criarSupabaseFalso({ documentos = {}, dias = {} } = {}) {
  const banco = new Map(Object.entries(documentos).map(([chave, conteudo]) => [chave, { conteudo, versao: 1 }]));
  const tabelaDias = new Map(Object.entries(dias).map(([data, conteudo]) => [data, { conteudo, versao: 1 }]));
  const historico = [];
  const sessoes = new Map();
  const gravacoes = [];
  const saidas = [];
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
  let falhasDeGravacao = 0;
  let leiturasDeDiasSeguras = null;

  // Versão do formato do conteúdo (campo esquema); o servidor não aceita voltar a um formato mais antigo
  const esquema = conteudo => (conteudo && typeof conteudo.esquema === 'number' ? Math.floor(conteudo.esquema) : 0);
  const salvar = (mapa, chave, conteudo, versaoLida) => {
    const atual = mapa.get(chave);
    if (atual && esquema(conteudo) < esquema(atual.conteudo)) return [409, { code: 'PT409', message: `${chave} está num formato mais novo` }];
    const versaoAtual = atual ? atual.versao : 0;
    if (versaoLida !== versaoAtual) return [409, { code: 'PT409', message: `${chave} foi alterado por outra pessoa` }];
    mapa.set(chave, { conteudo, versao: versaoAtual + 1 });
    return [200, versaoAtual + 1];
  };

  const atender = async route => {
    const req = route.request();
    const url = new URL(req.url());
    const responder = (status, corpo) => route.fulfill({
      status, headers: { ...cors, 'Content-Type': 'application/json' }, body: corpo === undefined ? '' : JSON.stringify(corpo)
    });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const conta = sessoes.get((req.headers().authorization || '').replace(/^Bearer /, ''));
    const comPerfil = conta && conta.perfil;
    const operador = conta && conta.perfil === 'operador';

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
      saidas.push(url.searchParams.get('scope'));
      sessoes.delete((req.headers().authorization || '').replace(/^Bearer /, ''));
      return route.fulfill({ status: 204, headers: cors });
    }

    if (req.method() === 'GET') {
      if (url.pathname === '/rest/v1/perfis') return responder(200, comPerfil ? [{ perfil: conta.perfil, nome: conta.nome }] : []);
      if (!comPerfil) return responder(200, []);
      if (url.pathname === '/rest/v1/documentos') {
        return responder(200, consultar([...banco].map(([chave, d]) => ({ chave, ...d })), url).map(({ conteudo, versao }) => ({ conteudo, versao })));
      }
      if (url.pathname === '/rest/v1/dias') {
        await leiturasDeDiasSeguras;
        return responder(200, consultar([...tabelaDias].map(([data, d]) => ({ data, ...d })), url));
      }
      if (url.pathname === '/rest/v1/historico') return responder(200, consultar(historico, url));
    }

    if (req.method() === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
      const funcao = url.pathname.slice('/rest/v1/rpc/'.length);
      const args = req.postDataJSON();
      if (funcao === 'salvar_documento' || funcao === 'salvar_dia') {
        const chave = funcao === 'salvar_dia' ? `dia:${args.p_data}` : args.p_chave;
        gravacoes.push({ chave, versaoLida: args.p_versao_lida, por: conta && conta.email });
        if (falhasDeGravacao > 0) {
          falhasDeGravacao--;
          return responder(503, { message: 'Service Unavailable' });
        }
      }
      if (!operador) return responder(403, { code: '42501', message: 'somente operadores podem alterar a escala' });
      if (funcao === 'salvar_documento') {
        // Depois da conversão (o cadastro existe), os documentos da fase 2 ficam só como cópia
        if (args.p_chave !== 'cadastro' && banco.has('cadastro')) return responder(409, { code: 'PT409', message: `${args.p_chave} é da versão anterior do app` });
        return responder(...salvar(banco, args.p_chave, args.p_conteudo, args.p_versao_lida));
      }
      if (funcao === 'salvar_dia') return responder(...salvar(tabelaDias, args.p_data, args.p_conteudo, args.p_versao_lida));
      if (funcao === 'registrar_historico') {
        const id = historico.length + 1;
        historico.push({ id, data: args.p_data, registrado_em: new Date(Date.now() + id).toISOString(), usuario: conta.id, autor: conta.nome,
          tipo: args.p_tipo, descricao: args.p_descricao, reverter: args.p_reverter ?? null, reverte: args.p_reverte ?? null, importado: false });
        return responder(200, id);
      }
      if (funcao === 'importar_historico') {
        if (historico.some(h => h.importado)) return responder(200, 0);
        for (const e of args.p_entradas) {
          historico.push({ id: historico.length + 1, data: args.p_data, registrado_em: e.registrado_em || new Date().toISOString(), usuario: null, autor: null,
            tipo: e.tipo, descricao: e.descricao, reverter: null, reverte: null, importado: true });
        }
        return responder(200, args.p_entradas.length);
      }
    }
    return responder(404, { message: `rota não simulada: ${req.method()} ${url.pathname}` });
  };

  return {
    banco,
    dias: tabelaDias,
    historico,
    gravacoes,
    saidas,
    instalar: context => context.route(`${URL_TESTE}/**`, atender),
    // Simula indisponibilidade do servidor nas próximas gravações
    falharGravacoes(n) { falhasDeGravacao = n; },
    // Segura as leituras da tabela dias até chamar a função devolvida (uma data que demora a carregar)
    segurarLeiturasDeDias() {
      let liberar;
      leiturasDeDiasSeguras = new Promise(resolve => { liberar = resolve; });
      return () => { leiturasDeDiasSeguras = null; liberar(); };
    },
    // Simula a gravação de outra pessoa (para testar conflitos)
    alterarPorOutraPessoa(chave, conteudo) {
      const atual = banco.get(chave);
      banco.set(chave, { conteudo, versao: (atual ? atual.versao : 0) + 1 });
    },
    alterarDiaPorOutraPessoa(data, conteudo) {
      const atual = tabelaDias.get(data);
      tabelaDias.set(data, { conteudo, versao: (atual ? atual.versao : 0) + 1 });
    }
  };
}

export async function instalarSupabaseFalso(context, opcoes) {
  const servidor = criarSupabaseFalso(opcoes);
  await servidor.instalar(context);
  return servidor;
}
