-- Fase 5: perfil Administrador. Tem tudo o que o Operador tem e, além disso, cria e exclui contas.
-- (Valor novo de enum fica numa migração própria: só pode ser usado depois de gravado.)
alter type public.perfil_acesso add value if not exists 'administrador';
