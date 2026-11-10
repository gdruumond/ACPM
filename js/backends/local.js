// Backend local: os documentos da escala ficam no localStorage deste navegador (modo sem login).
export const CHAVES_LOCAIS = { estado: 'acpm3', escala: 'acpm3_res', historico: 'acpm3_audit', bi: 'acpm3_bi' };
export const CHAVE_LEGADA = 'acpm2';

const chaveLocal = documento => {
  if (!Object.hasOwn(CHAVES_LOCAIS, documento)) throw new Error(`documento desconhecido: ${documento}`);
  return CHAVES_LOCAIS[documento];
};

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
  }
};
