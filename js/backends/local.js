// Backend local: os documentos da escala ficam no localStorage deste navegador (modo sem login).
// cadastro e dia:AAAA-MM-DD são o formato por data (fase 3); estado, escala, historico e bi, o da fase 2.
export const CHAVES_LOCAIS = { cadastro: 'acpm4_cadastro', estado: 'acpm3', escala: 'acpm3_res', historico: 'acpm3_audit', bi: 'acpm3_bi' };
export const CHAVE_LEGADA = 'acpm2';
const PREFIXO_DIA = 'acpm4_dia_';
const CHAVE_HISTORICO = 'acpm4_historico';
const DOCUMENTO_DIA = /^dia:(\d{4}-\d{2}-\d{2})$/;

const chaveLocal = documento => {
  const dia = DOCUMENTO_DIA.exec(documento);
  if (dia) return PREFIXO_DIA + dia[1];
  if (!Object.hasOwn(CHAVES_LOCAIS, documento)) throw new Error(`documento desconhecido: ${documento}`);
  return CHAVES_LOCAIS[documento];
};

const lerJson = chave => {
  try { return JSON.parse(localStorage.getItem(chave)); } catch (e) { return null; }
};

function datasGuardadas() {
  const datas = [];
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave && chave.startsWith(PREFIXO_DIA)) datas.push(chave.slice(PREFIXO_DIA.length));
  }
  return datas.sort();
}

// Ids crescentes para o histórico local (o modo local não tem servidor para numerar as entradas)
const proximoId = lista => Math.max(Date.now(), ...lista.map(e => e.id + 1));

// Formato acpm2 (7 janelas) convertido para as 9 janelas atuais
function converterAcpm2(o) {
  if (!(o && o.stu && o.ins && o.lim)) return null;
  const OLD = [0,1,2,2,3,3,4,5,6], NEW = [0,1,2,4,6,7,8];
  o.win = OLD.map(k => o.win[k]);
  o.ins.forEach(i => i.aw = OLD.map(k => i.aw[k]));
  o.stu.forEach(d => {
    d.p1 = d.p1 < 0 ? -1 : NEW[d.p1];
    d.p2 = d.p2 < 0 ? -1 : NEW[d.p2];
    d.ss = 1;
  });
  return o;
}

export const backendLocal = {
  async ler(documento) {
    const chave = chaveLocal(documento);
    try {
      const x = JSON.parse(localStorage.getItem(chave));
      if (x || documento !== 'estado') return x;
      return converterAcpm2(JSON.parse(localStorage.getItem(CHAVE_LEGADA)));
    } catch (e) { return null; }
  },

  async gravar(documento, conteudo) {
    const chave = chaveLocal(documento);
    try {
      localStorage.setItem(chave, JSON.stringify(conteudo));
      return true;
    } catch (e) { return false; }
  },

  async listarDias(de, ate) {
    return datasGuardadas()
      .filter(d => d >= de && d <= ate)
      .map(d => ({ data: d, conteudo: lerJson(PREFIXO_DIA + d) }))
      .filter(dia => dia.conteudo !== null);
  },

  async diaAnterior(data) {
    const anterior = datasGuardadas().filter(d => d < data).pop();
    return anterior ? { data: anterior, conteudo: lerJson(PREFIXO_DIA + anterior) } : null;
  },

  // Histórico local: guarda as últimas 1000 entradas
  async registrar({ data, tipo, descricao, reverter = null, reverte = null }) {
    const lista = lerJson(CHAVE_HISTORICO) || [];
    const id = proximoId(lista);
    lista.push({ id, data, registrado_em: new Date().toISOString(), autor: null, tipo, descricao, reverter, reverte, importado: false });
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista.slice(-1000)));
    return id;
  },

  async listarHistorico(data) {
    return (lerJson(CHAVE_HISTORICO) || [])
      .filter(e => e.data === data)
      .sort((a, b) => (a.registrado_em < b.registrado_em) - (a.registrado_em > b.registrado_em) || b.id - a.id);
  },

  // Só no modo local: o botão "Limpar" do histórico e o "Limpar BI" (dias simulados)
  async limparHistorico(data) {
    const lista = (lerJson(CHAVE_HISTORICO) || []).filter(e => e.data !== data);
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista));
  },

  async removerDiasSimulados() {
    for (const d of datasGuardadas()) {
      const dia = lerJson(PREFIXO_DIA + d);
      if (dia && dia.simulado) localStorage.removeItem(PREFIXO_DIA + d);
    }
  },

  async importarHistorico(data, entradas) {
    const lista = lerJson(CHAVE_HISTORICO) || [];
    if (lista.some(e => e.importado)) return 0;
    let id = proximoId(lista);
    for (const e of entradas) {
      lista.push({ id: id++, data, registrado_em: e.registrado_em || new Date().toISOString(), autor: null,
        tipo: e.tipo, descricao: e.descricao, reverter: null, reverte: null, importado: true });
    }
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista.slice(-1000)));
    return entradas.length;
  }
};
