-- Fase 4: perfil Secretaria. Registra os pedidos de voo na agenda de solicitações; a escala ela só consulta.
-- (Valor novo de enum fica numa migração própria: só pode ser usado depois de gravado.)
alter type public.perfil_acesso add value if not exists 'secretaria';
