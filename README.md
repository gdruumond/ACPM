# Escala de Voo — ACPM

Planejamento da escala diária de voo, simulador e Ground School do ACPM.
Publicada pelo GitHub Pages em https://gdruumond.github.io/ACPM/ (branch `main`, sem etapa de build).

## Modos de uso

- **Compartilhado (site publicado):** login com e-mail e senha; os dados ficam no Supabase e todos veem a mesma escala.
  O perfil da conta define o acesso: **Operador** edita, **Gestor** só consulta. O cadastro aberto é desligado: as contas
  são criadas pelo administrador (`scripts/criar-conta.mjs`).
- **Local (`localhost`):** sem login, dados só no `localStorage` do navegador. Em localhost, `?supabase=previa` usa o
  projeto de prévia (com login).

| Endereço | Projeto Supabase |
|---|---|
| https://gdruumond.github.io/ACPM/ | `acpm-escala` (produção) |
| https://thephfernandes.github.io/ACPM/ (prévia) | `acpm-escala-preview` |

## Rodar localmente

A aplicação usa módulos ES, então precisa ser servida por HTTP (abrir o `index.html` direto do disco não funciona):

```sh
npm install
npm run serve      # http://localhost:4173
```

## Testes

```sh
npm test               # unitários + E2E
npm run test:unit      # motor de alocação, regras e camada de dados (node:test)
npm run test:e2e       # aplicação no navegador (Playwright)
```

- Na primeira vez, `npx playwright install chromium` baixa o navegador dos testes.
  Para usar o Google Chrome já instalado: `PW_CHANNEL=chrome npm run test:e2e`.
- Para testar uma versão publicada em vez do servidor local:
  `BASE_URL=https://gdruumond.github.io/ACPM/ npm run test:e2e` (com a barra final).
- Os testes E2E comparam a escala gerada com snapshots em `test/e2e/__snapshots__/`. Se uma mudança
  de comportamento for intencional, atualize-os com `npx playwright test --update-snapshots` e revise o diff.
- `test/fixtures/motor-goldens.json` guarda a escala aprovada do motor para 40 cenários aleatórios e para o
  "Preencher exemplo". Depois de mudar uma regra do motor de propósito, regrave com
  `node scripts/capturar-goldens-motor.mjs` e revise a diferença.
- Os testes usam somente nomes e pesos fictícios.
- O modo compartilhado é testado com um servidor Supabase falso (`test/e2e/supabase-falso.js`) que segue o mesmo
  contrato do banco. `test/e2e/publicado.spec.js` entra no site publicado com login real (só roda com as senhas
  das contas no ambiente: veja o cabeçalho do arquivo).

## Banco de dados (Supabase)

- Esquema e regras de acesso em `supabase/migrations/`; testes pgTAP em `supabase/tests/database/`.
- Rode os testes do banco **somente no projeto de prévia** (o `supabase/` local fica vinculado a ele):
  `SUPABASE_DB_PASSWORD=... npm run test:db` (cada teste roda numa transação desfeita no final).
- Aplicar migrações: `supabase db push --remote` (prévia) ou `--remote=<ref de produção>`.
- Contas: `SUPABASE_DB_PASSWORD=... SENHA_NOVA=... node scripts/criar-conta.mjs <email> <operador|gestor> "<nome>"`.
- Dados fictícios na prévia: `node scripts/semear-previa.mjs`.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Marcação das seis abas |
| `css/app.css` | Estilos e temas claro/escuro |
| `js/config.js` | Janelas, frota, missões, níveis A01–A09, limites de peso |
| `js/rules.js` | Regras das missões (Ground School, nível mínimo, precedência) |
| `js/engine.js` | Motor de alocação (função pura) |
| `js/storage.js` | Migrações de dados e link compartilhado, sobre um backend (`js/backends/`: local ou Supabase) |
| `js/sessao.js`, `js/config-supabase.js` | Login, perfil de acesso e projeto Supabase de cada endereço |
| `js/state.js`, `js/actions.js` | Estado da aplicação e ações (perfil, desfazer, histórico, gerar escala) |
| `js/views/` | Renderização de cada aba |
| `js/export.js` | CSV e PDF |
| `js/main.js` | Eventos da interface e inicialização |

## Fluxo de trabalho

Alterações entram por branch + pull request. O GitHub Actions roda todos os testes em cada push e PR;
ao entrar na `main`, o GitHub Pages publica a nova versão.
