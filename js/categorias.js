// Categorias de recurso dos filtros da Escala e de Recursos, na ordem da operação: C152, C172, Simulador, PA-34 e
// a Sala Ground (que não está em Recursos: ela não tem controle de disponibilidade).
import { EQ, GROUND_REG } from './config.js';
import { esc } from './format.js';

export const CATEGORIAS = [
  { id: 'C152', nome: 'C152', tipos: ['C152'] },
  { id: 'C172', nome: 'C172', tipos: ['C172'] },
  { id: 'sim', nome: 'Simulador', tipos: ['Sim. Mono', 'Sim. Multi'] },
  { id: 'PA-34', nome: 'PA-34', tipos: ['PA-34'] },
  { id: 'ground', nome: 'Sala Ground', tipos: [] }
];

export const nomeDoRecurso = r => (r === GROUND_REG ? 'Sala Ground' : r);

export function categoriaDoRecurso(r) {
  if (r === GROUND_REG) return 'ground';
  const categoria = CATEGORIAS.find(c => c.tipos.some(tipo => (EQ[tipo] || []).includes(r)));
  return categoria ? categoria.id : null;
}

export const recursosDaCategoria = id => (id === 'ground' ? [GROUND_REG]
  : ((CATEGORIAS.find(c => c.id === id) || { tipos: [] }).tipos).flatMap(tipo => EQ[tipo] || []));

// Opções do seletor: "Todos" e as categorias (em Recursos, sem a Sala Ground)
export const opcoesDeCategoria = ({ comGround = true } = {}) => '<option value="">Todos</option>' +
  CATEGORIAS.filter(c => comGround || c.id !== 'ground').map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
