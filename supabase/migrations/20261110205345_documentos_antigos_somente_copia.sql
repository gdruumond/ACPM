-- Fase 3: depois da conversão para a escala por data (o documento "cadastro" existe), os documentos da fase 2
-- (estado, escala, historico e bi) ficam só como cópia. Uma aba ainda aberta com a versão anterior do app recebe
-- conflito (409) ao gravá-los e pede para recarregar a página, em vez de gravar onde o app novo não lê mais.
create or replace function public.salvar_documento(p_chave text, p_conteudo jsonb, p_versao_lida integer)
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  nova_versao integer;
begin
  if public.perfil_atual() is distinct from 'operador' then
    raise exception 'somente operadores podem alterar a escala' using errcode = '42501';
  end if;

  if p_chave <> 'cadastro' and exists (select 1 from public.documentos where chave = 'cadastro') then
    raise exception 'o documento % é da versão anterior do app; recarregue a página', p_chave using errcode = 'PT409';
  end if;

  if p_versao_lida = 0 then
    insert into public.documentos (chave, conteudo, versao, atualizado_por)
    values (p_chave, p_conteudo, 1, auth.uid())
    on conflict (chave) do nothing
    returning versao into nova_versao;
  else
    update public.documentos
    set conteudo = p_conteudo, versao = versao + 1, atualizado_por = auth.uid(), atualizado_em = now()
    where chave = p_chave and versao = p_versao_lida
    returning versao into nova_versao;
  end if;

  if nova_versao is null then
    raise exception 'o documento % foi alterado por outra pessoa', p_chave using errcode = 'PT409';
  end if;
  return nova_versao;
end;
$$;
