// Backend Supabase: documentos compartilhados no banco (tabela documentos), gravados pela função
// salvar_documento com controle de concorrência otimista (versão lida).
// - Gravações do mesmo documento saem em série, sempre com o conteúdo mais recente
// - Se outra pessoa gravou antes (conflito), o backend para de gravar e avisa por aoConflito
// - Erros de rede avisam por aoErro; a próxima alteração tenta gravar de novo
export function criarBackendSupabase(cliente, { aoConflito = () => {}, aoErro = () => {} } = {}) {
  const versoes = {};
  const pendentes = {};
  const emAndamento = {};
  let bloqueado = false;

  async function enviar(documento) {
    try {
      while (!bloqueado && Object.hasOwn(pendentes, documento)) {
        const conteudo = pendentes[documento];
        delete pendentes[documento];
        const { data, error } = await cliente.rpc('salvar_documento', {
          p_chave: documento, p_conteudo: conteudo, p_versao_lida: versoes[documento] ?? 0
        });
        if (error) {
          delete pendentes[documento];
          if (error.code === 'PT409') {
            bloqueado = true;
            aoConflito(documento);
          } else {
            aoErro(error, documento);
          }
          return false;
        }
        versoes[documento] = data;
      }
      return !bloqueado;
    } finally {
      delete emAndamento[documento];
    }
  }

  return {
    async ler(documento) {
      const { data, error } = await cliente.from('documentos').select('conteudo, versao').eq('chave', documento).maybeSingle();
      if (error) throw new Error(error.message);
      versoes[documento] = data ? data.versao : 0;
      return data ? data.conteudo : null;
    },

    gravar(documento, conteudo) {
      if (bloqueado) return Promise.resolve(false);
      pendentes[documento] = conteudo;
      return (emAndamento[documento] ||= enviar(documento));
    }
  };
}
