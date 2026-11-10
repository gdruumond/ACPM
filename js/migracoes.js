// Versões do formato dos dados guardados (cadastro e dias). Cada versão tem um passo que transforma o formato
// anterior no seguinte sem perder nada: campos que o passo não conhece são mantidos. As leituras aplicam os passos
// que faltam, então o app sempre trabalha no formato atual; no primeiro acesso de um operador depois de uma mudança,
// os dados guardados são regravados no formato atual (ApiClient.atualizarFormatoGravado).
// Sem o campo "esquema": formato da fase 3 (versão 4).
import { habilitacoesDoNivel } from './habilitacoes.js';

export const ESQUEMA = 6;

// Versão 5 (fase 4): simuladores com os nomes usados no aeroclube
const SIMULADORES_RENOMEADOS = { 'SIM-MONO-1': 'SIM-MONO-A', 'SIM-MONO-2': 'SIM-MONO-C', 'SIM-MULTI-1': 'SIM-MLTE-E', 'SIM-MULTI-2': 'SIM-MLTE-D' };
export const renomearSimulador = r => (Object.hasOwn(SIMULADORES_RENOMEADOS, r) ? SIMULADORES_RENOMEADOS[r] : r);

const PASSOS = {
  5: {
    cadastro: cadastro => cadastro,
    dia: dia => {
      const novo = { ...dia };
      if (dia.av && typeof dia.av === 'object') {
        novo.av = Object.fromEntries(Object.entries(dia.av).map(([r, disponivel]) => [renomearSimulador(r), disponivel]));
      }
      if (dia.resultado && Array.isArray(dia.resultado.out)) {
        novo.resultado = { ...dia.resultado, out: dia.resultado.out.map(o => (o && typeof o.r === 'string' ? { ...o, r: renomearSimulador(o.r) } : o)) };
      }
      return novo;
    }
  },
  // Versão 6 (fase 4): habilitações individuais no lugar dos níveis cumulativos A01–A09. Cada instrutor recebe
  // exatamente o que o seu nível permitia; o nível fica no registro só como cópia (não é mais usado)
  6: {
    cadastro: cadastro => (Array.isArray(cadastro.ins)
      ? { ...cadastro, ins: cadastro.ins.map(x => (x && !Array.isArray(x.hab) ? { ...x, hab: habilitacoesDoNivel(x.lv) } : x)) }
      : cadastro),
    dia: dia => dia
  }
};

const versaoDe = doc => (typeof doc.esquema === 'number' ? doc.esquema : 4);

export const precisaMigrar = doc => Boolean(doc) && typeof doc === 'object' && versaoDe(doc) < ESQUEMA;

function migrar(doc, parte) {
  if (!doc || typeof doc !== 'object') return doc;
  let atual = doc;
  for (let versao = versaoDe(doc) + 1; versao <= ESQUEMA; versao++) atual = { ...PASSOS[versao][parte](atual), esquema: versao };
  return atual;
}

export const migrarCadastro = cadastro => migrar(cadastro, 'cadastro');
export const migrarDia = dia => migrar(dia, 'dia');
