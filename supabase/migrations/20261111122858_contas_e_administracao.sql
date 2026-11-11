-- Fase 5: contas gerenciadas pelo Administrador (criar, listar e excluir), sem depender do painel do Supabase.

-- O Administrador tem tudo o que o Operador tem: nas regras de gravação da escala, da agenda e do histórico ele conta
-- como operador. (O perfil de verdade continua na tabela perfis, que é o que o app mostra.)
create or replace function public.perfil_atual()
  returns public.perfil_acesso
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select case when perfil = 'administrador' then 'operador'::public.perfil_acesso else perfil end
  from public.perfis where usuario = (select auth.uid())
$$;

-- Quem está chamando é administrador?
create function public.administrador_atual()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from public.perfis where usuario = (select auth.uid()) and perfil = 'administrador')
$$;
revoke execute on function public.administrador_atual() from public, anon;
grant execute on function public.administrador_atual() to authenticated;

create function public.listar_contas()
  returns table (usuario uuid, email text, nome text, perfil public.perfil_acesso, criado_em timestamptz, ultimo_acesso timestamptz)
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  if not public.administrador_atual() then
    raise exception 'somente administradores gerenciam contas' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, coalesce(p.nome, ''), p.perfil, u.created_at, u.last_sign_in_at
    from auth.users u
    left join public.perfis p on p.usuario = u.id
    order by lower(coalesce(nullif(p.nome, ''), u.email::text));
end;
$$;
revoke execute on function public.listar_contas() from public, anon;
grant execute on function public.listar_contas() to authenticated;

-- Conta nova com e-mail e senha (a pessoa troca a senha depois em "Minha conta"). Mesmo formato das contas criadas
-- por scripts/criar-conta.mjs: e-mail confirmado, senha em bcrypt e o perfil de acesso.
create function public.criar_conta(p_email text, p_senha text, p_perfil public.perfil_acesso, p_nome text)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  email_novo text := lower(trim(coalesce(p_email, '')));
  nome_novo text := trim(coalesce(p_nome, ''));
  nova uuid := gen_random_uuid();
begin
  if not public.administrador_atual() then
    raise exception 'somente administradores gerenciam contas' using errcode = '42501';
  end if;
  if email_novo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;
  if char_length(coalesce(p_senha, '')) < 12 then
    raise exception 'a senha precisa ter pelo menos 12 caracteres' using errcode = '22023';
  end if;
  if p_perfil is null or char_length(nome_novo) not between 1 and 80 then
    raise exception 'informe o perfil e o nome (até 80 caracteres)' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where lower(email) = email_novo) then
    raise exception 'já existe uma conta com este e-mail' using errcode = '23505';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', nova, 'authenticated', 'authenticated', email_novo,
    extensions.crypt(p_senha, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (nova, nova::text, jsonb_build_object('sub', nova::text, 'email', email_novo, 'email_verified', true), 'email', now(), now(), now());
  insert into public.perfis (usuario, perfil, nome) values (nova, p_perfil, nome_novo);
  return nova;
end;
$$;
revoke execute on function public.criar_conta(text, text, public.perfil_acesso, text) from public, anon;
grant execute on function public.criar_conta(text, text, public.perfil_acesso, text) to authenticated;

-- Exclui a conta (o perfil vai junto; nos registros da escala, do histórico e da agenda a autoria fica pelo nome).
-- Ninguém exclui a própria conta, então sempre sobra pelo menos um administrador.
create function public.excluir_conta(p_usuario uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not public.administrador_atual() then
    raise exception 'somente administradores gerenciam contas' using errcode = '42501';
  end if;
  if p_usuario = (select auth.uid()) then
    raise exception 'não é possível excluir a própria conta' using errcode = '22023';
  end if;
  delete from auth.users where id = p_usuario;
  if not found then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.excluir_conta(uuid) from public, anon;
grant execute on function public.excluir_conta(uuid) to authenticated;
