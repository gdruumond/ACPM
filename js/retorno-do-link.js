// Volta dos links de confirmação da troca de e-mail: o Supabase Auth abre o site com o resultado no fragmento
// da URL. Com a troca confirmada nos dois endereços, a sessão com o e-mail novo vem no fragmento (o supabase-js
// a lê sozinho); com um só, vem uma mensagem; com o link expirado ou já usado, vem um erro.
// Devolve 'concluida', 'falta-outro', 'invalido' ou null (nada a avisar).
export function retornoDoLink(fragmento) {
  const p = new URLSearchParams(String(fragmento || '').replace(/^#/, ''));
  if (p.has('error') || p.has('error_code') || p.has('error_description')) return 'invalido';
  if (p.has('access_token')) return p.get('type') === 'email_change' ? 'concluida' : null;
  if (p.has('message')) return 'falta-outro';
  return null;
}
