// Minha conta (trocar a senha e o e-mail) e, para administradores, as contas de todos (criar e excluir).
import { ApiClient } from '../storage.js';
import { $ } from '../dom.js';
import { esc, opts } from '../format.js';
import { PERFIS, ROTULOS, gerenciaContas } from '../perfis.js';
import { FUSO_DO_AEROCLUBE } from '../agenda.js';

export function mensagem(seletor, texto, tipo = 'erro') {
  $(seletor).textContent = texto;
  $(seletor).className = `conta-msg ${tipo}`;
}

const quando = instante => (instante
  ? new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_DO_AEROCLUBE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(instante)).replace(',', '')
  : 'nunca');

export async function abrirConta() {
  $('#conta-dados').textContent = `${ApiClient.autorAtual} · ${ApiClient.emailAtual} · ${ROTULOS[ApiClient.perfil] || ApiClient.perfil}`;
  const administrador = gerenciaContas(ApiClient.perfil);
  $('#usuarios').hidden = !administrador;
  if (!administrador) return;
  if (!$('#nc-perfil').options.length) $('#nc-perfil').innerHTML = opts(PERFIS.map(p => [p, ROTULOS[p]]), 'operador');
  await carregarContas();
}

export async function carregarContas() {
  let contas;
  try {
    contas = await ApiClient.contas();
  } catch (e) {
    $('#lista-contas').innerHTML = '<p class="h">Não foi possível carregar as contas. Verifique a conexão.</p>';
    return;
  }
  $('#lista-contas').innerHTML = `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Último acesso</th><th></th></tr></thead>
    <tbody>${contas.map(c => {
      const minha = c.email === ApiClient.emailAtual;
      return `<tr>
        <td><b>${esc(c.nome || '—')}</b></td>
        <td>${esc(c.email)}</td>
        <td>${c.perfil ? esc(ROTULOS[c.perfil] || c.perfil) : '<span class="h">sem perfil</span>'}</td>
        <td>${quando(c.ultimo_acesso)}</td>
        <td><button class="x" data-act="excluir-conta" data-id="${esc(c.usuario)}" data-email="${esc(c.email)}"${minha ? ' disabled title="Sua conta"' : ''}>Excluir</button></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

// Senha inicial aleatória (sem caracteres que se confundem, como 0/O e 1/l)
export function gerarSenha(tamanho = 16) {
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const limite = 256 - (256 % letras.length);
  let senha = '';
  while (senha.length < tamanho) {
    for (const b of crypto.getRandomValues(new Uint8Array(tamanho))) {
      if (b < limite && senha.length < tamanho) senha += letras[b % letras.length];
    }
  }
  return senha;
}
