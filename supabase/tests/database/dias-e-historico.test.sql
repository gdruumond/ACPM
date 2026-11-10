-- Fase 3: escala por data (tabela dias), histórico de alterações em tabela própria e cadastro separado.
-- Roda dentro de uma transação desfeita no final: não deixa dados no banco.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

-- Começa sem dias, histórico e cadastro (o banco de prévia tem dados de demonstração)
delete from public.historico;
delete from public.dias;
delete from public.documentos where chave in ('cadastro', 'escala');

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-b000-000000000001', 'operador@teste-f3.acpm.invalid', now(), now()),
  ('00000000-0000-4000-b000-000000000002', 'gestor@teste-f3.acpm.invalid', now(), now()),
  ('00000000-0000-4000-b000-000000000003', 'sem-perfil@teste-f3.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-b000-000000000001', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-b000-000000000002', 'gestor', 'Gestor de teste');

-- Estrutura
select has_table('public', 'dias', 'tabela dias existe');
select has_table('public', 'historico', 'tabela historico existe');
select ok((select relrowsecurity from pg_class where oid = 'public.dias'::regclass), 'RLS ativo em dias');
select ok((select relrowsecurity from pg_class where oid = 'public.historico'::regclass), 'RLS ativo em historico');

-- Operador: cadastro, dias e histórico
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000001","role":"authenticated"}', true);
select is(public.salvar_documento('escala', '{"out":[]}', 0), 1, 'antes da conversão, os documentos da fase 2 continuam sendo gravados');
select is(public.salvar_documento('cadastro', '{"ins":[]}', 0), 1, 'documentos aceita a chave cadastro');
select throws_ok($$ select public.salvar_documento('escala', '{"out":[1]}', 1) $$, 'PT409', null,
  'depois da conversão (o cadastro existe), gravar um documento da fase 2 é conflito: a aba antiga pede para recarregar');
select is(public.salvar_documento('cadastro', '{"ins":[1]}', 1), 2, 'o cadastro continua sendo gravado');

select is(public.salvar_dia('2026-11-11', '{"v":1}', 0), 1, 'operador cria a escala de uma data (versão 1)');
select is(public.salvar_dia('2026-11-11', '{"v":2}', 1), 2, 'operador grava com a versão que leu');
select throws_ok($$ select public.salvar_dia('2026-11-11', '{"v":3}', 1) $$, 'PT409', null, 'versão desatualizada é rejeitada');
select throws_ok($$ select public.salvar_dia('2026-11-11', '{"v":3}', 0) $$, 'PT409', null, 'criar uma data que já existe é conflito');
select results_eq($$ select conteudo, versao, atualizado_por from public.dias where data = '2026-11-11' $$,
  $$ values ('{"v":2}'::jsonb, 2, '00000000-0000-4000-b000-000000000001'::uuid) $$, 'guarda conteúdo, versão e quem gravou');
select throws_ok($$ insert into public.dias (data, conteudo) values ('2026-11-12', '{}') $$, '42501', null, 'escrita direta em dias é bloqueada');
select is_empty($$ update public.dias set conteudo = '{}' returning data $$, 'update direto em dias não altera nada');
select is_empty($$ delete from public.dias returning data $$, 'delete direto em dias não apaga nada');

select isnt(public.registrar_historico('2026-11-11', 'exc', 'PR-BTB: Manutenção', '{"kind":"setAv","reg":"PR-BTB","val":true}'), null,
  'operador registra uma alteração no histórico');
select results_eq($$ select data, usuario, tipo, descricao, reverter ->> 'reg', importado from public.historico $$,
  $$ values ('2026-11-11'::date, '00000000-0000-4000-b000-000000000001'::uuid, 'exc', 'PR-BTB: Manutenção', 'PR-BTB', false) $$,
  'a entrada guarda data, autor, tipo, descrição e como reverter');
select is((select autor from public.historico order by id desc limit 1), 'Operador de teste',
  'a entrada guarda o nome de quem alterou (os perfis dos colegas não são visíveis)');
select isnt(public.registrar_historico('2026-11-11', 'inc', 'Revertido: PR-BTB', null, (select max(id) from public.historico)), null,
  'uma entrada pode indicar qual entrada ela reverte');
select throws_ok($$ select public.registrar_historico('2026-11-11', 'outro', 'x') $$, '23514', null, 'tipo precisa ser inc, exc ou mod');
select throws_ok($$ select public.registrar_historico('2026-11-11', 'mod', '') $$, '23514', null, 'descrição não pode ser vazia');
select throws_ok($$ insert into public.historico (tipo, descricao) values ('mod', 'x') $$, '42501', null, 'escrita direta no histórico é bloqueada');
select is_empty($$ update public.historico set descricao = 'alterada' returning id $$, 'ninguém altera entradas do histórico');
select is(public.importar_historico('2026-11-11',
  '[{"registrado_em":"2026-11-09T10:00:00Z","tipo":"inc","descricao":"Antiga 1"},{"registrado_em":"2026-11-09T11:00:00Z","tipo":"mod","descricao":"Antiga 2"}]'),
  2, 'importa o histórico da fase 2');
select is(public.importar_historico('2026-11-11', '[{"registrado_em":"2026-11-09T12:00:00Z","tipo":"inc","descricao":"De novo"}]'),
  0, 'a importação acontece uma vez só');
select results_eq($$ select data, usuario, registrado_em, descricao from public.historico where importado order by registrado_em $$,
  $$ values ('2026-11-11'::date, null::uuid, '2026-11-09T10:00:00Z'::timestamptz, 'Antiga 1'), ('2026-11-11'::date, null::uuid, '2026-11-09T11:00:00Z'::timestamptz, 'Antiga 2') $$,
  'entradas importadas: sem autor, com o horário original e a data informada');

-- Gestor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000002","role":"authenticated"}', true);
select results_eq($$ select data from public.dias $$, $$ values ('2026-11-11'::date) $$, 'gestor lê as escalas por data');
select is((select count(*) from public.historico)::int, 4, 'gestor lê o histórico');
select throws_ok($$ select public.salvar_dia('2026-11-11', '{}', 2) $$, '42501', null, 'gestor não grava escalas');
select throws_ok($$ select public.registrar_historico('2026-11-11', 'mod', 'x') $$, '42501', null, 'gestor não registra no histórico');
select throws_ok($$ select public.importar_historico('2026-11-11', '[]') $$, '42501', null, 'gestor não importa histórico');

-- Conta sem perfil
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-000000000003","role":"authenticated"}', true);
select is_empty($$ select data from public.dias $$, 'conta sem perfil não lê escalas');
select is_empty($$ select id from public.historico $$, 'conta sem perfil não lê o histórico');

-- Visitante anônimo
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select data from public.dias $$, '42501', null, 'anônimo não acessa escalas');
select throws_ok($$ select id from public.historico $$, '42501', null, 'anônimo não acessa o histórico');
select throws_ok($$ select public.salvar_dia('2026-11-11', '{}', 2) $$, '42501', null, 'anônimo não executa salvar_dia');
select throws_ok($$ select public.registrar_historico('2026-11-11', 'mod', 'x') $$, '42501', null, 'anônimo não registra no histórico');

select * from finish();
rollback;
