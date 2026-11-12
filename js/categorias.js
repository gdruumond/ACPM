// Categorias de recurso dos filtros da Escala, de Recursos e do BI, na ordem da operação: C152, C172, Simulador,
// PA-34 e a Sala Ground (que não está em Recursos: ela não tem controle de disponibilidade). Os recursos de cada
// categoria vêm da frota do cadastro.
import { GROUND_REG, GROUND_EQ_TYPE } from './config.js';
import { esc } from './format.js';

export const CATEGORIAS = [
  { id: 'C152', nome: 'C152', tipos: ['C152'] },
  { id: 'C172', nome: 'C172', tipos: ['C172'] },
  { id: 'sim', nome: 'Simulador', tipos: ['Sim. Mono', 'Sim. Multi'] },
  { id: 'PA-34', nome: 'PA-34', tipos: ['PA-34'] },
  { id: 'ground', nome: 'Sala Ground', tipos: [GROUND_EQ_TYPE] }
];

export const nomeDoRecurso = r => (r === GROUND_REG ? 'Sala Ground' : r);

// A categoria de um tipo (C152, Sim. Mono, Sala Ground…): vale também para um recurso que já saiu da frota
export const categoriaDoTipo = tipo => (CATEGORIAS.find(c => c.tipos.includes(tipo)) || { id: null }).id;

export function categoriaDoRecurso(r, frota) {
  if (r === GROUND_REG) return 'ground';
  const recurso = (frota || []).find(f => f.reg === r);
  return recurso ? categoriaDoTipo(recurso.tipo) : null;
}

export const recursosDaCategoria = (id, frota) => (id === 'ground' ? [GROUND_REG]
  : (frota || []).filter(f => categoriaDoTipo(f.tipo) === id).map(f => f.reg));

// Opções do seletor: "Todos" e as categorias (em Recursos, sem a Sala Ground)
export const opcoesDeCategoria = ({ comGround = true } = {}) => '<option value="">Todos</option>' +
  CATEGORIAS.filter(c => comGround || c.id !== 'ground').map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
