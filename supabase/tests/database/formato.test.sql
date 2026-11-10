-- Fase 4: o conteúdo dos documentos e dos dias guarda a versão do formato (campo "esquema"). O servidor não aceita
-- um conteúdo num formato mais antigo do que o guardado: uma aba com a versão anterior do app não desfaz a
-- atualização dos dados. Roda dentro de uma transação desfeita no final: não deixa dados no banco.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

delete from public.dias;
delete from public.documentos where chave = 'cadastro';

insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-c000-000000000001', 'operador@teste-f4.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-c000-000000000001', 'operador', 'Operador de teste');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-000000000001","role":"authenticated"}', true);

-- Dias
select is(public.salvar_dia('2026-11-11', '{"v":1}', 0), 1, 'dia sem versão de formato (fase 3) é aceito');
select is(public.salvar_dia('2026-11-11', '{"esquema":5,"v":2}', 1), 2, 'atualizar o formato do dia é aceito');
select throws_ok($$ select public.salvar_dia('2026-11-11', '{"v":3}', 2) $$, 'PT409', null,
  'voltar o dia a um formato mais antigo é recusado (aba com a versão anterior do app)');
select is(public.salvar_dia('2026-11-11', '{"esquema":5,"v":3}', 2), 3, 'o mesmo formato continua sendo gravado');
select throws_ok($$ select public.salvar_dia('2026-11-11', '{"esquema":"5","v":4}', 3) $$, 'PT409', null,
  'versão de formato que não é número conta como a mais antiga');
select is((select conteudo ->> 'v' from public.dias where data = '2026-11-11'), '3', 'o dia guardado não mudou com as recusas');

-- Cadastro (tabela documentos)
select is(public.salvar_documento('cadastro', '{"ins":[]}', 0), 1, 'cadastro sem versão de formato (fase 3) é aceito');
select is(public.salvar_documento('cadastro', '{"esquema":5,"ins":[]}', 1), 2, 'atualizar o formato do cadastro é aceito');
select throws_ok($$ select public.salvar_documento('cadastro', '{"ins":[1]}', 2) $$, 'PT409', null,
  'voltar o cadastro a um formato mais antigo é recusado');

select * from finish();
rollback;
