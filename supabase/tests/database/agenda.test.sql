-- Fase 4: agenda de solicitações e perfil Secretaria. Roda dentro de uma transação desfeita no final.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

delete from public.solicitacoes;
insert into auth.users (id, email, created_at, updated_at) values
  ('00000000-0000-4000-d000-000000000001', 'secretaria@teste-agenda.acpm.invalid', now(), now()),
  ('00000000-0000-4000-d000-000000000002', 'operador@teste-agenda.acpm.invalid', now(), now()),
  ('00000000-0000-4000-d000-000000000003', 'gestor@teste-agenda.acpm.invalid', now(), now()),
  ('00000000-0000-4000-d000-000000000004', 'sem-perfil@teste-agenda.acpm.invalid', now(), now());
insert into public.perfis (usuario, perfil, nome) values
  ('00000000-0000-4000-d000-000000000001', 'secretaria', 'Secretaria de teste'),
  ('00000000-0000-4000-d000-000000000002', 'operador', 'Operador de teste'),
  ('00000000-0000-4000-d000-000000000003', 'gestor', 'Gestor de teste');

-- Estrutura
select has_table('public', 'solicitacoes', 'tabela solicitacoes existe');
select ok((select relrowsecurity from pg_class where oid = 'public.solicitacoes'::regclass), 'RLS ativo na agenda');

-- Prazo das 13:00 (horário de São Paulo)
select is(public.prazo_da_agenda_permite('2026-11-11', '2026-11-10 12:59:00-03'), true, 'amanhã: aceito até 12:59');
select is(public.prazo_da_agenda_permite('2026-11-11', '2026-11-10 13:00:00-03'), false, 'amanhã: encerrado às 13:00');
select is(public.prazo_da_agenda_permite('2026-11-12', '2026-11-10 13:00:00-03'), true, 'depois das 13:00, a partir de dois dias');
select is(public.prazo_da_agenda_permite('2026-11-10', '2026-11-10 08:00:00-03'), false, 'o próprio dia nunca');
select is(public.prazo_da_agenda_permite('2026-11-09', '2026-11-10 08:00:00-03'), false, 'dia passado nunca');
select is(public.prazo_da_agenda_permite('2026-11-11', '2026-11-10 15:30:00+00'), true, '15:30 UTC é 12:30 em São Paulo');
select is(public.prazo_da_agenda_permite('2026-11-11', '2026-11-10 16:30:00+00'), false, '16:30 UTC é 13:30 em São Paulo');

-- Secretaria
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000001","role":"authenticated"}', true);
select isnt(public.registrar_solicitacao(current_date + 5, 1000, ' Aluno 1000 ', 'Voo Local', 'manha', null, ' Maria '), null,
  'secretaria registra um pedido dentro do prazo');
select results_eq($$ select data, aluno, aluno_nome, registrado_por, conta, excecao, usuario from public.solicitacoes $$,
  $$ values (current_date + 5, 1000, 'Aluno 1000', 'Maria', 'Secretaria de teste', false, '00000000-0000-4000-d000-000000000001'::uuid) $$,
  'guarda o aluno, quem anotou (sem espaços sobrando), a conta e que não foi exceção');
select isnt((select registrado_em from public.solicitacoes), null, 'guarda a hora do registro');
select throws_ok($$ select public.registrar_solicitacao(current_date - 1, 1000, 'Aluno', 'Voo Local', 'manha', null, 'Maria') $$,
  'PT403', null, 'fora do prazo: recusado');
select throws_ok($$ select public.registrar_solicitacao(current_date - 1, 1000, 'Aluno', 'Voo Local', 'manha', null, 'Maria', null, true) $$,
  '42501', null, 'a secretaria não usa a exceção da coordenação');
select throws_ok($$ select public.registrar_solicitacao(current_date + 5, 1000, 'Aluno', 'Voo Local', 'manha', null, '   ') $$,
  '23514', null, '"Registrado por" é obrigatório');
select throws_ok($$ select public.registrar_solicitacao(current_date + 5, 1000, 'Aluno', 'Voo Local', 'madrugada', null, 'Maria') $$,
  '23514', null, 'disponibilidade precisa ser manhã, tarde, noite ou horário');
select throws_ok($$ select public.registrar_solicitacao(current_date + 5, 1000, 'Aluno', 'Voo Local', 'horario', null, 'Maria') $$,
  '23514', null, 'horário específico precisa do horário');
select isnt(public.registrar_solicitacao(current_date + 5, 1001, 'Aluno 1001', 'IFR', 'horario', '14:30', 'Maria', 'Prefere o PP-ABP'), null,
  'pedido com horário específico e observação');
select throws_ok($$ insert into public.solicitacoes (data, aluno, aluno_nome, missao, janela, registrado_por) values (current_date + 5, 1, 'A', 'B', 'manha', 'C') $$,
  '42501', null, 'escrita direta na agenda é bloqueada');
select throws_ok($$ select public.salvar_dia(current_date + 5, '{}', 0) $$, '42501', null, 'a secretaria não altera a escala');
select lives_ok($$ select public.cancelar_solicitacao((select min(id) from public.solicitacoes), 'Maria') $$, 'secretaria cancela um pedido');
select is((select cancelada_por from public.solicitacoes where id = (select min(id) from public.solicitacoes)), 'Maria', 'o cancelamento guarda quem cancelou');
select throws_ok($$ select public.cancelar_solicitacao((select min(id) from public.solicitacoes), 'Maria') $$, 'P0002', null, 'não cancela duas vezes');

-- Operador: exceção da coordenação
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000002","role":"authenticated"}', true);
select isnt(public.registrar_solicitacao(current_date, 1002, 'Aluno 1002', 'Voo Local', 'tarde', null, 'Coordenação', null, true), null,
  'operador registra fora do prazo pela exceção da coordenação');
select is((select excecao from public.solicitacoes where aluno = 1002), true, 'o pedido fica marcado como exceção');

-- Gestor, conta sem perfil e anônimo
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000003","role":"authenticated"}', true);
select is((select count(*) from public.solicitacoes)::int, 3, 'gestor lê a agenda');
select throws_ok($$ select public.registrar_solicitacao(current_date + 5, 1000, 'Aluno', 'Voo Local', 'manha', null, 'Gestor') $$,
  '42501', null, 'gestor não registra pedidos');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-000000000004","role":"authenticated"}', true);
select is_empty($$ select id from public.solicitacoes $$, 'conta sem perfil não lê a agenda');

select * from finish();
rollback;
