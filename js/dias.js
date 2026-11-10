// Escala por data. O estado da aplicação (o mesmo formato usado pelo motor e pelas telas) é guardado em
// duas partes: o cadastro, igual em todas as datas (instrutores e alunos), e o dia, com o que muda de
// uma data para outra (janelas, aeronaves, disponibilidade dos instrutores, demanda e status dos voos).
import { WIN, EQ, DEFAULT_LIM } from './config.js';
import { blank } from './rules.js';

const CAMPOS_DO_PEDIDO = ['fly', 'mis', 'eq', 'p1', 'p2', 'nb', 'ss', 'pr'];
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const avPadrao = () => Object.fromEntries(Object.values(EQ).flat().map(r => [r, true]));

export const diaPadrao = () => ({ win: WIN.map(() => true), av: avPadrao(), ins: {}, pedidos: {}, fStatus: {} });

export function separar(estado) {
  return {
    cadastro: {
      nid: estado.nid,
      ins: estado.ins.map(({ id, nm, lv, kg }) => ({ id, nm, lv, kg })),
      stu: estado.stu.map(({ id, nm, kg, bl }) => ({ id, nm, kg, bl: [...(bl || [])] }))
    },
    dia: {
      win: [...estado.win],
      av: { ...estado.av },
      ins: Object.fromEntries(estado.ins.map(x => [x.id, { on: x.on, aw: [...x.aw] }])),
      pedidos: Object.fromEntries(estado.stu.map(s => [s.id, {
        ...Object.fromEntries(CAMPOS_DO_PEDIDO.map(c => [c, s[c]])),
        extra: structuredClone(s.extra || [])
      }])),
      fStatus: { ...(estado.fStatus || {}) }
    }
  };
}

// Junta cadastro e dia num estado novo (sem compartilhar objetos com o dia guardado).
// Quem não aparece no dia fica disponível (instrutor) ou sem missão (aluno).
export function juntar(cadastro, dia = diaPadrao()) {
  const disponibilidade = dia.ins || {};
  const pedidos = dia.pedidos || {};
  return {
    schemaVer: 4,
    win: Array.isArray(dia.win) ? [...dia.win] : WIN.map(() => true),
    av: { ...avPadrao(), ...(dia.av || {}) },
    lim: { ...DEFAULT_LIM },
    nid: cadastro.nid,
    ins: cadastro.ins.map(x => {
      const d = disponibilidade[x.id];
      return { ...x, on: d ? d.on !== false : true, aw: d && Array.isArray(d.aw) ? [...d.aw] : WIN.map(() => true) };
    }),
    stu: cadastro.stu.map(s => ({
      ...s,
      bl: [...(s.bl || [])],
      ...(pedidos[s.id] ? structuredClone(pedidos[s.id]) : { ...blank(), extra: [] })
    })),
    fStatus: { ...(dia.fStatus || {}) }
  };
}

// Nova data: começa com a disponibilidade e a demanda do dia anterior, sem status dos voos nem escala gerada
export function diaParaCopiar(anterior) {
  if (!anterior || !anterior.ins || !anterior.pedidos) return diaPadrao();
  const { win, av, ins, pedidos } = structuredClone(anterior);
  return { win, av, ins, pedidos, fStatus: {} };
}

// A escala da fase 2 não guardava a data: usa a gravada (fase 2), senão o dia do BI com a mesma escala
export function inferirDataDaEscala(escala, bi, padrao) {
  if (escala && DATA_ISO.test(escala.data || '')) return escala.data;
  if (escala && Array.isArray(escala.out)) {
    const alvo = JSON.stringify(escala.out);
    const igual = Object.keys(bi || {}).sort().reverse().find(d => bi[d] && JSON.stringify(bi[d].out) === alvo);
    if (igual) return igual;
  }
  return padrao;
}

// O id das entradas do histórico da fase 2 é o Date.now() de quando foram criadas
const horarioDoId = id => (Number.isFinite(id) && id > Date.UTC(2020, 0, 1) && id < Date.UTC(2100, 0, 1) ? new Date(id).toISOString() : null);

// Converte os documentos da fase 2 (estado já normalizado, escala, histórico e BI) no formato por data
export function converterLegado({ estado, escala, historico, bi }, dataPadrao) {
  const dataAtual = inferirDataDaEscala(escala, bi, dataPadrao);
  const { cadastro, dia } = separar(estado);
  const dias = { [dataAtual]: { ...dia, resultado: escala && Array.isArray(escala.out) ? escala : null } };
  for (const [data, registro] of Object.entries(bi || {})) {
    if (data === dataAtual || !DATA_ISO.test(data) || !registro || !Array.isArray(registro.out)) continue;
    dias[data] = {
      importado: true,
      resultado: { out: registro.out, al: [], tot: registro.tot ?? registro.out.length, rej: registro.rej ?? 0, data }
    };
  }
  const entradas = (historico || [])
    .filter(e => e && ['inc', 'exc', 'mod'].includes(e.type) && e.desc)
    .map(e => ({ registrado_em: horarioDoId(e.id), tipo: e.type, descricao: String(e.desc) }));
  return { cadastro, dataAtual, dias, historico: entradas };
}

// BI a partir das escalas guardadas: { data: { out, tot, rej } } para cada data com escala gerada
export function biDosDias(dias) {
  return Object.fromEntries(dias
    .filter(d => d.conteudo && d.conteudo.resultado && Array.isArray(d.conteudo.resultado.out))
    .map(({ data, conteudo: { resultado: r } }) => [data, {
      out: r.out,
      tot: r.tot,
      rej: r.rej ?? (r.al || []).filter(a => a.t === 'err').length
    }]));
}
