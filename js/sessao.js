// Login e perfil no modo compartilhado (Supabase): pede e-mail e senha, carrega o perfil da conta
// (Operador edita, Gestor só consulta) e liga o ApiClient ao banco.
import { ApiClient } from './storage.js';
import { criarBackendSupabase } from './backends/supabase.js';
import { backendLocal } from './backends/local.js';
import { setRole } from './actions.js';
import { $ } from './dom.js';
import { amanhaISO } from './format.js';

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

// Primeiro acesso de um operador com o servidor vazio: oferece enviar os dados que este navegador já tinha
// (modo local). Documentos que já existem no servidor nunca são sobrescritos.
async function oferecerEnvioDosDadosLocais() {
  const servidor = ApiClient.backend;
  if (await servidor.ler('cadastro') || await servidor.ler('estado')) return;
  const local = await backendLocal.ler('estado');
  if (!local || !Array.isArray(local.ins) || !Array.isArray(local.stu)) return;

  document.body.dataset.login = 'sim';
  $('#form-login').hidden = true;
  $('#envio-local').hidden = false;
  $('#envio-local-texto').textContent = `Este navegador tem dados da escala (${local.ins.length} instrutores e ${local.stu.length} alunos) que ainda não estão no servidor. Enviá-los para que todos usem os mesmos dados?`;
  const enviar = await new Promise(resolve => {
    $('#btn-enviar-local').onclick = () => resolve(true);
    $('#btn-ignorar-local').onclick = () => resolve(false);
  });
  $('#envio-local').hidden = true;
  if (!enviar) return;

  // Os dados do navegador (formato da fase 2) chegam ao servidor já no formato por data
  await ApiClient.migrarDocumentosAntigos(amanhaISO(), backendLocal);
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
  ApiClient.autorAtual = perfil.nome || sessao.user.email;
  setRole(perfil.perfil, perfil.perfil === 'gestor');
  if (perfil.perfil === 'operador') await oferecerEnvioDosDadosLocais();
  delete document.body.dataset.login;
  return true;
}
