-- Fase 3: o histórico guarda o nome de quem alterou. Cada conta só lê o próprio perfil, então o nome é
-- copiado do perfil (ou o e-mail, se não houver nome) no momento do registro.
alter table public.historico add column autor text;

create or replace function public.registrar_historico(
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
  insert into public.historico (data, usuario, autor, tipo, descricao, reverter, reverte)
  values (
    p_data, auth.uid(),
    (select coalesce(nullif(p.nome, ''), u.email) from auth.users u left join public.perfis p on p.usuario = u.id where u.id = auth.uid()),
    p_tipo, p_descricao, p_reverter, p_reverte
  )
  returning id into nova;
  return nova;
end;
$$;
