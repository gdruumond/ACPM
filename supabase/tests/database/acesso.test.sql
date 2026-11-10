-- Regras de acesso aos dados compartilhados (perfis Operador e Gestor) e gravação com controle de versão.
-- Roda dentro de uma transação desfeita no final: não deixa dados no banco.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

-- Começa sem documentos (o banco de prévia tem dados de demonstração; a transação é desfeita no final)
delete from public.documentos;

-- Usuários de teste: um operador, um gestor e uma conta sem perfil
insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-a000-000000000001', 'operador@teste.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000002', 'gestor@teste.acpm.invalid', now(), now()),
  ('00000000-0000-4000-a000-000000000003', 'sem-perfil@teste.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-a000-000000000001', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-a000-000000000002', 'gestor', 'Gestor de teste');

-- Estrutura
select has_table('public', 'documentos', 'tabela de documentos existe');
select has_table('public', 'perfis', 'tabela de perfis existe');
select ok((select relrowsecurity from pg_class where oid = 'public.documentos'::regclass), 'RLS ativo em documentos');
select ok((select relrowsecurity from pg_class where oid = 'public.perfis'::regclass), 'RLS ativo em perfis');

-- Operador
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}', true);
select is(public.salvar_documento('estado', '{"v":1}', 0), 1, 'operador cria o documento (versão 1)');
select is(public.salvar_documento('estado', '{"v":2}', 1), 2, 'operador grava com a versão que leu');
select throws_ok($$ select public.salvar_documento('estado', '{"v":3}', 1) $$, 'PT409', null,
  'versão desatualizada é rejeitada (outra pessoa gravou antes)');
select throws_ok($$ select public.salvar_documento('estado', '{"v":3}', 0) $$, 'PT409', null,
  'criar um documento que já existe também é conflito');
select results_eq($$ select conteudo, versao, atualizado_por from public.documentos where chave = 'estado' $$,
  $$ values ('{"v":2}'::jsonb, 2, '00000000-0000-4000-a000-000000000001'::uuid) $$,
  'guarda o conteúdo, a versão e quem gravou');
select throws_ok($$ select public.salvar_documento('outra-chave', '{}', 0) $$, '23514', null,
  'só aceita as chaves estado, escala, historico e bi');
select throws_ok($$ insert into public.documentos (chave, conteudo) values ('bi', '{}') $$, '42501', null,
  'escrita direta na tabela é bloqueada (somente pela função)');
select is_empty($$ update public.documentos set conteudo = '{}' returning chave $$, 'update direto não altera nada');
select is_empty($$ delete from public.documentos returning chave $$, 'delete direto não apaga nada');
select results_eq($$ select usuario, perfil::text from public.perfis $$,
  $$ values ('00000000-0000-4000-a000-000000000001'::uuid, 'operador') $$, 'cada usuário vê somente o próprio perfil');

-- Gestor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated"}', true);
select results_eq($$ select chave from public.documentos $$, $$ values ('estado') $$, 'gestor lê os documentos');
select throws_ok($$ select public.salvar_documento('estado', '{"v":9}', 2) $$, '42501', null, 'gestor não grava');
select is_empty($$ update public.perfis set perfil = 'operador' returning usuario $$, 'gestor não muda o próprio perfil');
select is(public.perfil_atual()::text, 'gestor', 'perfil_atual informa o perfil de quem chama');

-- Conta sem perfil
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated"}', true);
select is_empty($$ select chave from public.documentos $$, 'conta sem perfil não lê documentos');
select throws_ok($$ select public.salvar_documento('estado', '{}', 2) $$, '42501', null, 'conta sem perfil não grava');
select is(public.perfil_atual(), null, 'conta sem perfil não tem perfil');

-- Visitante anônimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select chave from public.documentos $$, '42501', null, 'anônimo não acessa documentos');
select throws_ok($$ select usuario from public.perfis $$, '42501', null, 'anônimo não acessa perfis');
select throws_ok($$ select public.salvar_documento('estado', '{}', 2) $$, '42501', null, 'anônimo não executa salvar_documento');

select * from finish();
rollback;
