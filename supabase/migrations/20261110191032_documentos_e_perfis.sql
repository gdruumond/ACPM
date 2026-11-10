-- Fase 2: dados compartilhados da escala, com login e perfis de acesso.
-- Operador edita; Gestor só consulta. As contas são criadas pelo administrador (cadastro aberto desligado).

-- Perfis de acesso -----------------------------------------------------------
create type public.perfil_acesso as enum ('operador', 'gestor');

create table public.perfis (
  usuario uuid primary key references auth.users (id) on delete cascade,
  perfil public.perfil_acesso not null,
  nome text not null default '',
  criado_em timestamptz not null default now()
);
comment on table public.perfis is 'Perfil de acesso de cada conta. Sem perfil, a conta não vê nada.';

alter table public.perfis enable row level security;
revoke all on public.perfis from anon;

-- Cada conta lê somente o próprio perfil; ninguém altera o próprio perfil pela API
create policy "cada conta lê o próprio perfil" on public.perfis
  for select to authenticated
  using (usuario = (select auth.uid()));

-- Perfil de quem está chamando (null para quem não tem perfil)
create function public.perfil_atual()
  returns public.perfil_acesso
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select perfil from public.perfis where usuario = (select auth.uid())
$$;
revoke execute on function public.perfil_atual() from public, anon;
grant execute on function public.perfil_atual() to authenticated;

-- Documentos da aplicação ----------------------------------------------------
-- Fase 2: um documento por chave, as mesmas do localStorage (estado, escala, histórico e BI).
create table public.documentos (
  chave text primary key check (chave in ('estado', 'escala', 'historico', 'bi')),
  conteudo jsonb not null,
  versao integer not null default 1 check (versao > 0),
  atualizado_por uuid references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
comment on table public.documentos is 'Documentos compartilhados da escala. Gravação somente por public.salvar_documento.';

alter table public.documentos enable row level security;
revoke all on public.documentos from anon;

-- Quem tem perfil (operador ou gestor) lê. Não há políticas de escrita: grava-se só pela função abaixo.
create policy "contas com perfil leem" on public.documentos
  for select to authenticated
  using ((select public.perfil_atual()) is not null);

-- Gravação com controle de concorrência otimista: só grava se a versão lida ainda for a atual.
-- p_versao_lida = 0 cria o documento. Conflito responde HTTP 409 (código PT409) para o app recarregar.
create function public.salvar_documento(p_chave text, p_conteudo jsonb, p_versao_lida integer)
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
revoke execute on function public.salvar_documento(text, jsonb, integer) from public, anon;
grant execute on function public.salvar_documento(text, jsonb, integer) to authenticated;
