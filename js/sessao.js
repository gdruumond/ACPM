// Login e perfil no modo compartilhado (Supabase): pede e-mail e senha, carrega o perfil da conta
// (Operador edita, Gestor só consulta) e liga o ApiClient ao banco.
import { ApiClient } from './storage.js';
import { criarBackendSupabase } from './backends/supabase.js';
import { setRole } from './actions.js';
import { $ } from './dom.js';

const ROTULO = { operador: 'Operador', gestor: 'Gestor' };

// Aviso fixo no topo: o conflito só sai recarregando; o erro de gravação some quando uma gravação der certo
let avisoAtual = null;
function mostrarAviso(tipo, texto) {
  avisoAtual = tipo;
  $('#aviso-sync-texto').textContent = texto;
  $('#aviso-sync').hidden = false;
  $('#btn-recarregar').onclick = () => window.location.reload();
}

function pedirLogin(cliente) {
  document.body.dataset.login = 'sim';
  $('#login-email').focus();
  return new Promise(resolve => {
    $('#form-login').onsubmit = async e => {
      e.preventDefault();
      $('#btn-entrar').disabled = true;
      $('#login-erro').textContent = '';
      const { data, error } = await cliente.auth.signInWithPassword({
        email: $('#login-email').value.trim(),
        password: $('#login-senha').value
      });
      $('#btn-entrar').disabled = false;
      if (error) {
        $('#login-erro').textContent = error.status === 400
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar. Verifique a conexão e tente de novo.';
        return;
      }
      $('#login-senha').value = '';
      resolve(data.session);
    };
  });
}

async function sair(cliente) {
  await cliente.auth.signOut();
  window.location.reload();
}

// Devolve true quando o app pode carregar os dados (conta com perfil); false deixa o aviso na tela
export async function iniciarSessaoSupabase(projeto) {
  document.body.dataset.backend = 'supabase';
  const cliente = window.supabase.createClient(projeto.url, projeto.chave, { auth: { storageKey: `acpm-${projeto.nome}` } });
  const { data } = await cliente.auth.getSession();
  const sessao = data.session || await pedirLogin(cliente);

  const { data: perfil, error } = await cliente.from('perfis').select('perfil, nome').maybeSingle();
  if (error) throw new Error(`Não foi possível carregar o perfil: ${error.message}`);
  if (!perfil) {
    document.body.dataset.login = 'sim';
    $('#form-login').hidden = true;
    $('#sem-acesso').hidden = false;
    $('#sem-acesso-email').textContent = sessao.user.email;
    $('#btn-sair-sem-acesso').onclick = () => sair(cliente);
    return false;
  }

  delete document.body.dataset.login;
  ApiClient.backend = criarBackendSupabase(cliente, {
    aoConflito: () => mostrarAviso('conflito', 'Outra pessoa alterou a escala enquanto você editava. Recarregue para ver a versão atual; a sua última alteração não foi salva.'),
    aoErro: () => { if (avisoAtual !== 'conflito') mostrarAviso('erro', 'Não foi possível salvar a última alteração. Verifique a conexão: a próxima alteração tentará salvar de novo.'); },
    aoGravar: () => { if (avisoAtual === 'erro') { avisoAtual = null; $('#aviso-sync').hidden = true; } }
  });
  $('#btn-share-link').title = 'Copiar o link da escala desta data (quem abrir entra com a própria conta)';
  $('#usuario').textContent = `${perfil.nome || sessao.user.email} · ${ROTULO[perfil.perfil]}`;
  $('#usuario').hidden = false;
  $('#btn-sair').hidden = false;
  $('#btn-sair').onclick = () => sair(cliente);
  setRole(perfil.perfil, perfil.perfil === 'gestor');
  return true;
}
