// Selos de atenção nas abas: avisos da escala (vermelho quando alguma missão não entrou), aviões parados ou com menos
// de 5 h até a revisão de 50 horas e pedidos da agenda para a data que ainda não estão na demanda.
import { $ } from '../dom.js';
import { RES, S, DATA, isGestor } from '../state.js';
import { REVISAO_H } from '../config.js';
import { ApiClient } from '../storage.js';

const PERTO_DA_REVISAO_H = 5;

function selo(aba, quantidade, tipo, dica) {
  const el = $(`#selo-${aba}`);
  if (!el) return;
  el.hidden = !quantidade;
  el.textContent = quantidade ? String(quantidade) : '';
  el.className = `aba-selo${tipo ? ' ' + tipo : ''}`;
  el.title = quantidade ? dica : '';
}

export function atualizarSelosDaEscala() {
  const alertas = (RES && RES.al) || [];
  const erros = alertas.filter(a => a.t === 'err').length;
  if (erros) selo('esc', erros, 'erro', erros === 1 ? '1 missão não entrou na escala' : `${erros} missões não entraram na escala`);
  else selo('esc', alertas.length, 'aviso', `${alertas.length} ${alertas.length === 1 ? 'aviso' : 'avisos'} na escala`);

  const revisao = (RES && RES.revisao) || {};
  const atencao = Object.entries(revisao)
    .filter(([r, v]) => S.av[r] !== false && (v.paraAs !== null || REVISAO_H - v.fim < PERTO_DA_REVISAO_H)).length;
  selo('rec', atencao, 'aviso', `${atencao} ${atencao === 1 ? 'avião parado ou perto' : 'aviões parados ou perto'} da revisão de 50 horas`);
  atualizarSeloDaAgenda();
}

// Pedidos da agenda para a data aberta: lidos ao abrir a data e depois de mudanças na agenda
let pedidosDaData = { data: null, lista: [] };

export async function lerPedidosDaData() {
  const data = DATA;
  let lista = [];
  try { lista = await ApiClient.agenda(data, data); } catch (e) { lista = []; }
  if (data !== DATA) return;
  pedidosDaData = { data, lista: Array.isArray(lista) ? lista : [] };
  atualizarSeloDaAgenda();
}

export const pedidosPendentes = () => (pedidosDaData.data === DATA
  ? pedidosDaData.lista.filter(s => !s.cancelada_em && !(S.importadas || []).includes(s.id))
  : []);

// Quem consulta (Gestor e Secretaria) não importa pedidos: o selo é para quem opera a escala
export function atualizarSeloDaAgenda() {
  const n = isGestor() ? 0 : pedidosPendentes().length;
  selo('age', n, '', `${n} ${n === 1 ? 'pedido da agenda ainda não está' : 'pedidos da agenda ainda não estão'} na demanda`);
  // Na Demanda, o botão diz quantos pedidos há para importar (e só se destaca quando há)
  const botao = $('#importar-agenda');
  if (!botao) return;
  botao.textContent = n ? `Importar ${n} ${n === 1 ? 'pedido' : 'pedidos'} da agenda` : 'Importar da agenda';
  botao.classList.toggle('sec', !n);
}
