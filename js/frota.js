// A frota (aviões e simuladores) fica no cadastro desde a fase 7: cada recurso tem a matrícula, o tipo e, no C152
// acrobático, "Só Parafuso". O operador acrescenta e retira recursos na aba Recursos; o limite de peso e o controle
// das 50 horas vêm do tipo. A sala de Ground não faz parte da frota (é uma só, sempre disponível).
import { EQ, ACROBAT_REG } from './config.js';

export const TIPOS_DA_FROTA = ['C152', 'C172', 'PA-34', 'Sim. Mono', 'Sim. Multi'];

// A frota que estava no código antes da fase 7: o cadastro começa com ela (passo 11 do formato dos dados)
export const FROTA_INICIAL = Object.entries(EQ).flatMap(([tipo, regs]) =>
  regs.map(reg => ({ reg, tipo, ...(reg === ACROBAT_REG ? { soParafuso: true } : {}) })));

const MATRICULA = /^[A-Z0-9][A-Z0-9-]{1,14}$/;
const recurso = ({ reg, tipo, soParafuso }) => ({ reg, tipo, ...(soParafuso === true && tipo === 'C152' ? { soParafuso: true } : {}) });

// Só recursos válidos (matrícula em maiúsculas, sem repetir, e um tipo conhecido); sem lista, a frota inicial
export function normalizarFrota(frota) {
  if (!Array.isArray(frota)) return FROTA_INICIAL.map(recurso);
  const vistas = new Set();
  return frota.filter(f => f && typeof f === 'object').map(f => ({ ...f, reg: typeof f.reg === 'string' ? f.reg.trim().toUpperCase() : '' }))
    .filter(f => MATRICULA.test(f.reg) && TIPOS_DA_FROTA.includes(f.tipo) && !vistas.has(f.reg) && vistas.add(f.reg))
    .map(recurso);
}

// As matrículas de um tipo. As que só voam Parafuso ficam para o Parafuso (e só para ele)
export const matriculasDoTipo = (frota, tipo, { parafuso = false } = {}) => frota
  .filter(f => f.tipo === tipo && Boolean(f.soParafuso) === (parafuso && tipo === 'C152'))
  .map(f => f.reg);

export const recursoDaFrota = (frota, r) => frota.find(f => f.reg === r) || null;

// Um recurso novo (aba Recursos): devolve o recurso pronto ou o motivo para não aceitar
export function novoRecurso(frota, { reg, tipo, soParafuso }) {
  const matricula = typeof reg === 'string' ? reg.trim().toUpperCase() : '';
  if (!matricula) return { erro: 'Informe a matrícula.' };
  if (!MATRICULA.test(matricula)) return { erro: 'Matrícula inválida: use letras, números e hífen (por exemplo, PR-ABC).' };
  if (!TIPOS_DA_FROTA.includes(tipo)) return { erro: 'Escolha a categoria.' };
  if (recursoDaFrota(frota, matricula)) return { erro: `Já existe um recurso com a matrícula ${matricula}.` };
  return { recurso: recurso({ reg: matricula, tipo, soParafuso }) };
}
