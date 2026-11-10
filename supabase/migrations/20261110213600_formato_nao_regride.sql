-- Fase 4: o conteúdo do cadastro e de cada dia guarda a versão do formato dos dados (campo "esquema"; sem ele,
-- formato da fase 3). O servidor não aceita um conteúdo num formato mais antigo do que o guardado: uma aba ainda
-- aberta com a versão anterior do app recebe conflito (409) e pede para recarregar, em vez de desfazer a
-- atualização dos dados (por exemplo, perdendo campos que a versão anterior não conhece).

-- Versão do formato de um conteúdo: o campo "esquema" quando é número; senão 0 (formato mais antigo)
create function public.esquema_do_conteudo(p_conteudo jsonb)
  returns integer
  language sql
  immutable
  set search_path = ''
as $$
  select case when jsonb_typeof(p_conteudo -> 'esquema') = 'number' then floor((p_conteudo ->> 'esquema')::numeric)::integer else 0 end;
$$;
revoke execute on function public.esquema_do_conteudo(jsonb) from public, anon, authenticated;

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

  if public.esquema_do_conteudo(p_conteudo) <
     coalesce((select public.esquema_do_conteudo(conteudo) from public.documentos where chave = p_chave), 0) then
    raise exception 'o documento % está num formato mais novo; recarregue a página', p_chave using errcode = 'PT409';
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

create or replace function public.salvar_dia(p_data date, p_conteudo jsonb, p_versao_lida integer)
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

  if public.esquema_do_conteudo(p_conteudo) <
     coalesce((select public.esquema_do_conteudo(conteudo) from public.dias where data = p_data), 0) then
    raise exception 'a escala de % está num formato mais novo; recarregue a página', p_data using errcode = 'PT409';
  end if;

  if p_versao_lida = 0 then
    insert into public.dias (data, conteudo, versao, atualizado_por)
    values (p_data, p_conteudo, 1, auth.uid())
    on conflict (data) do nothing
    returning versao into nova_versao;
  else
    update public.dias
    set conteudo = p_conteudo, versao = versao + 1, atualizado_por = auth.uid(), atualizado_em = now()
    where data = p_data and versao = p_versao_lida
    returning versao into nova_versao;
  end if;

  if nova_versao is null then
    raise exception 'a escala de % foi alterada por outra pessoa', p_data using errcode = 'PT409';
  end if;
  return nova_versao;
end;
$$;
