// Coloca dados fictícios no projeto de PRÉVIA: 40 instrutores fictícios (A01–A09), sem alunos.
// Só grava se ainda não houver o documento "estado". Recusa rodar contra o projeto de produção.
//
// Uso: SUPABASE_DB_PASSWORD=... node scripts/semear-previa.mjs
//   Conexão: SUPABASE_DB_URL (sem a senha) ou o pooler do projeto vinculado (supabase/.temp/pooler-url).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { estadoSintetico } from '../test/helpers/estado.js';

const PRODUCAO = 'iszaomkinojwxymyglmh';
const url = process.env.SUPABASE_DB_URL || readFileSync(new URL('../supabase/.temp/pooler-url', import.meta.url), 'utf8').trim();
if (url.includes(PRODUCAO)) {
  console.error('Este script é só para o projeto de prévia, não para produção.');
  process.exit(2);
}
if (!process.env.SUPABASE_DB_PASSWORD) {
  console.error('Defina SUPABASE_DB_PASSWORD (senha do banco do projeto de prévia).');
  process.exit(2);
}

const sql = `
\\set ON_ERROR_STOP on
insert into public.documentos (chave, conteudo) values ('estado', $estado$${JSON.stringify(estadoSintetico())}$estado$::jsonb)
on conflict (chave) do nothing;
select 'estado: versão ' || versao || ', ' || jsonb_array_length(conteudo -> 'ins') || ' instrutores' from public.documentos where chave = 'estado';
`;

execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-f', '-'], {
  input: sql,
  env: { ...process.env, PGPASSWORD: process.env.SUPABASE_DB_PASSWORD, PGSSLMODE: 'require' },
  stdio: ['pipe', 'inherit', 'inherit']
});
