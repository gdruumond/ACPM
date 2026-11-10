-- Fase 4: agenda de solicitações (a agenda de papel da secretaria, digitalizada). Pela regra do aeroclube, o aluno
-- só pede voo para o dia seguinte até as 13:00 do dia anterior (horário de São Paulo); depois disso, só a partir de
-- dois dias. A "Exceção da Coordenação" (só operadores) registra um pedido fora do prazo, marcado para auditoria.
-- Os pedidos não são apagados: cancelar registra quem cancelou e quando.

create table public.solicitacoes (
  id bigint generated always as identity primary key,
  data date not null,
  aluno integer not null,
  aluno_nome text not null check (char_length(aluno_nome) between 1 and 80),
  missao text not null check (char_length(missao) between 1 and 60),
  janela text not null check (janela in ('manha', 'tarde', 'noite', 'horario')),
  horario text check (horario ~ '^[0-2][0-9]:[0-5][0-9]$'),
  observacao text check (char_length(observacao) <= 300),
  registrado_por text not null check (char_length(registrado_por) between 1 and 80),
  registrado_em timestamptz not null default now(),
  usuario uuid references auth.users (id) on delete set null,
  conta text,
  excecao boolean not null default false,
  cancelada_em timestamptz,
  cancelada_por text check (char_length(cancelada_por) between 1 and 80),
  cancelada_usuario uuid references auth.users (id) on delete set null,
  check ((janela = 'horario') = (horario is not null))
);
comment on table public.solicitacoes is 'Agenda de solicitações de voo. Gravação somente pelas funções registrar_solicitacao e cancelar_solicitacao.';
create index solicitacoes_data_idx on public.solicitacoes (data, registrado_em);

alter table public.solicitacoes enable row level security;
revoke all on public.solicitacoes from anon;

create policy "contas com perfil leem" on public.solicitacoes
  for select to authenticated
  using ((select public.perfil_atual()) is not null);

-- O prazo da agenda num instante: pedido para o dia seguinte até as 13:00; depois, a partir de dois dias
create function public.prazo_da_agenda_permite(p_data date, p_agora timestamptz)
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select p_data >= (p_agora at time zone 'America/Sao_Paulo')::date + 2
      or (p_data = (p_agora at time zone 'America/Sao_Paulo')::date + 1
          and (p_agora at time zone 'America/Sao_Paulo')::time < time '13:00');
$$;

create function public.registrar_solicitacao(
  p_data date, p_aluno integer, p_aluno_nome text, p_missao text, p_janela text, p_horario text,
  p_registrado_por text, p_observacao text default null, p_excecao boolean default false
)
  returns bigint
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  quem text := public.perfil_atual()::text;
  no_prazo boolean := public.prazo_da_agenda_permite(p_data, now());
  nova bigint;
begin
  if quem is null or quem not in ('secretaria', 'operador') then
    raise exception 'somente a secretaria e os operadores registram pedidos na agenda' using errcode = '42501';
  end if;
  if not no_prazo then
    if not coalesce(p_excecao, false) then
      raise exception 'prazo encerrado: pedido para o dia seguinte só até as 13:00' using errcode = 'PT403';
    end if;
    if quem <> 'operador' then
      raise exception 'a exceção da coordenação é só para operadores' using errcode = '42501';
    end if;
  end if;

  insert into public.solicitacoes (data, aluno, aluno_nome, missao, janela, horario, observacao, registrado_por, usuario, conta, excecao)
  values (
    p_data, p_aluno, trim(p_aluno_nome), p_missao, p_janela, p_horario, nullif(trim(p_observacao), ''), trim(p_registrado_por),
    auth.uid(),
    (select coalesce(nullif(p.nome, ''), u.email) from auth.users u left join public.perfis p on p.usuario = u.id where u.id = auth.uid()),
    not no_prazo
  )
  returning id into nova;
  return nova;
end;
$$;
revoke execute on function public.registrar_solicitacao(date, integer, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.registrar_solicitacao(date, integer, text, text, text, text, text, text, boolean) to authenticated;

create function public.cancelar_solicitacao(p_id bigint, p_cancelada_por text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if public.perfil_atual()::text is null or public.perfil_atual()::text not in ('secretaria', 'operador') then
    raise exception 'somente a secretaria e os operadores cancelam pedidos da agenda' using errcode = '42501';
  end if;
  update public.solicitacoes
  set cancelada_em = now(), cancelada_por = trim(p_cancelada_por), cancelada_usuario = auth.uid()
  where id = p_id and cancelada_em is null;
  if not found then
    raise exception 'pedido % não encontrado ou já cancelado', p_id using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.cancelar_solicitacao(bigint, text) from public, anon;
grant execute on function public.cancelar_solicitacao(bigint, text) to authenticated;
revoke execute on function public.prazo_da_agenda_permite(date, timestamptz) from public, anon;
grant execute on function public.prazo_da_agenda_permite(date, timestamptz) to authenticated;
