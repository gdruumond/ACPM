-- Fase 3: escala por data, cadastro separado e histórico de alterações em tabela própria.

-- Cadastro (instrutores e alunos) passa a ser um documento próprio. As chaves estado, escala, historico
-- e bi continuam aceitas: guardam o formato da fase 2, mantido como cópia depois da migração.
alter table public.documentos drop constraint documentos_chave_check;
alter table public.documentos add constraint documentos_chave_check
  check (chave in ('cadastro', 'estado', 'escala', 'historico', 'bi'));

-- Escala de cada data ------------------------------------------------------------------------------
-- Disponibilidade (janelas, aeronaves e instrutores), demanda dos alunos, status dos voos e a escala gerada.
create table public.dias (
  data date primary key,
  conteudo jsonb not null,
  versao integer not null default 1 check (versao > 0),
  atualizado_por uuid references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
comment on table public.dias is 'Escala de cada data. Gravação somente por public.salvar_dia.';

alter table public.dias enable row level security;
revoke all on public.dias from anon;

create policy "contas com perfil leem" on public.dias
  for select to authenticated
  using ((select public.perfil_atual()) is not null);

-- Mesmo controle de concorrência otimista de salvar_documento (versão lida; 0 cria; conflito = PT409)
create function public.salvar_dia(p_data date, p_conteudo jsonb, p_versao_lida integer)
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
revoke execute on function public.salvar_dia(date, jsonb, integer) from public, anon;
grant execute on function public.salvar_dia(date, jsonb, integer) to authenticated;

-- Histórico de alterações --------------------------------------------------------------------------
-- Só cresce: ninguém altera nem apaga entradas. Uma reversão é uma nova entrada que aponta a revertida.
create table public.historico (
  id bigint generated always as identity primary key,
  data date,
  registrado_em timestamptz not null default now(),
  usuario uuid references auth.users (id) on delete set null,
  tipo text not null check (tipo in ('inc', 'exc', 'mod')),
  descricao text not null check (char_length(descricao) between 1 and 500),
  reverter jsonb,
  reverte bigint references public.historico (id),
  importado boolean not null default false
);
comment on table public.historico is 'Alterações na escala (quem, quando, o quê). Gravação somente pelas funções registrar_historico e importar_historico.';
create index historico_data_idx on public.historico (data, registrado_em desc);

alter table public.historico enable row level security;
revoke all on public.historico from anon;

create policy "contas com perfil leem" on public.historico
  for select to authenticated
  using ((select public.perfil_atual()) is not null);

create function public.registrar_historico(
  p_data date, p_tipo text, p_descricao text, p_reverter jsonb default null, p_reverte bigint default null
)
  returns bigint
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  nova bigint;
begin
  if public.perfil_atual() is distinct from 'operador' then
    raise exception 'somente operadores podem alterar a escala' using errcode = '42501';
  end if;
  insert into public.historico (data, usuario, tipo, descricao, reverter, reverte)
  values (p_data, auth.uid(), p_tipo, p_descricao, p_reverter, p_reverte)
  returning id into nova;
  return nova;
end;
$$;
revoke execute on function public.registrar_historico(date, text, text, jsonb, bigint) from public, anon;
grant execute on function public.registrar_historico(date, text, text, jsonb, bigint) to authenticated;

-- Importação única do histórico da fase 2: entradas sem autor, com o horário original, todas na data informada
create function public.importar_historico(p_data date, p_entradas jsonb)
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  importadas integer;
begin
  if public.perfil_atual() is distinct from 'operador' then
    raise exception 'somente operadores podem alterar a escala' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('public.importar_historico'));
  if exists (select 1 from public.historico where importado) then
    return 0;
  end if;
  insert into public.historico (data, registrado_em, usuario, tipo, descricao, importado)
  select p_data, coalesce((e ->> 'registrado_em')::timestamptz, now()), null, e ->> 'tipo', left(e ->> 'descricao', 500), true
  from jsonb_array_elements(p_entradas) e
  where e ->> 'tipo' in ('inc', 'exc', 'mod') and coalesce(e ->> 'descricao', '') <> '';
  get diagnostics importadas = row_count;
  return importadas;
end;
$$;
revoke execute on function public.importar_historico(date, jsonb) from public, anon;
grant execute on function public.importar_historico(date, jsonb) to authenticated;
