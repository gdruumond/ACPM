// Roda os testes pgTAP de supabase/tests/database contra um projeto Supabase remoto usando o psql
// (o `supabase test db` exige Docker). Cada arquivo de teste roda numa transação desfeita no final.
//
// Uso: SUPABASE_DB_PASSWORD=... npm run test:db
//   Conexão: SUPABASE_DB_URL (sem a senha) ou o pooler do projeto vinculado (supabase/.temp/pooler-url).
//   Use sempre o projeto de prévia (acpm-escala-preview), nunca o de produção.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const url = process.env.SUPABASE_DB_URL || readFileSync(new URL('supabase/.temp/pooler-url', raiz), 'utf8').trim();
if (!process.env.SUPABASE_DB_PASSWORD) {
  console.error('Defina SUPABASE_DB_PASSWORD (senha do banco do projeto de prévia).');
  process.exit(2);
}

const pasta = new URL('supabase/tests/database/', raiz);
const arquivos = readdirSync(pasta).filter(f => f.endsWith('.test.sql')).sort();
let falhas = 0;

for (const arquivo of arquivos) {
  let saida;
  try {
    saida = execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-f', new URL(arquivo, pasta).pathname], {
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: process.env.SUPABASE_DB_PASSWORD, PGSSLMODE: 'require' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (e) {
    console.log(`✘ ${arquivo}: o psql parou com erro\n${(e.stdout || '').trim()}\n${(e.stderr || '').trim()}`);
    falhas++;
    continue;
  }
  const linhas = saida.split('\n').map(l => l.trim()).filter(Boolean);
  const plano = Number((linhas.find(l => /^1\.\.\d+$/.test(l)) || '1..0').slice(3));
  const resultados = linhas.filter(l => /^(not )?ok \d+/.test(l));
  const reprovados = resultados.filter(l => l.startsWith('not ok'));
  const ok = reprovados.length === 0 && resultados.length === plano && plano > 0;
  console.log(`${ok ? '✔' : '✘'} ${arquivo}: ${resultados.length - reprovados.length}/${plano} verificações`);
  reprovados.forEach(l => console.log(`   ${l}`));
  linhas.filter(l => l.startsWith('#')).forEach(l => console.log(`   ${l}`));
  if (!ok) falhas++;
}

process.exit(falhas ? 1 : 0);
