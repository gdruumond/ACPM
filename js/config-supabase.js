// Projetos Supabase por endereço do site. As chaves publicáveis vão para o navegador por definição:
// quem protege os dados são as regras de acesso do banco (supabase/migrations).
// Em localhost o app fica no modo local (localStorage, sem login); ?supabase=<nome> escolhe um projeto,
// inclusive o servidor falso usado pelos testes E2E. Fora do localhost esse parâmetro é ignorado.
export const PROJETOS = {
  producao: { url: 'https://iszaomkinojwxymyglmh.supabase.co', chave: 'sb_publishable_uE83acmJyTFQaWItt2anmg_CGyOdiEu' },
  previa: { url: 'https://llylkdgfuagzdaualvqa.supabase.co', chave: 'sb_publishable_cocQT4VY51WK-ZuKD6bBSQ_La2EpE3t' },
  teste: { url: 'https://acpm-teste.supabase.invalid', chave: 'sb_publishable_teste' }
};

const POR_ENDERECO = { 'gdruumond.github.io': 'producao', 'thephfernandes.github.io': 'previa' };
const LOCAIS = ['localhost', '127.0.0.1'];

export function projetoSupabase(endereco = window.location) {
  const nome = Object.hasOwn(POR_ENDERECO, endereco.hostname)
    ? POR_ENDERECO[endereco.hostname]
    : LOCAIS.includes(endereco.hostname) ? new URLSearchParams(endereco.search).get('supabase') : null;
  return nome && Object.hasOwn(PROJETOS, nome) ? { nome, ...PROJETOS[nome] } : null;
}
