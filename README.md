# Escala de Voo — ACPM

Planejamento da escala diária de voo, simulador e Ground School do ACPM.
Publicada pelo GitHub Pages em https://gdruumond.github.io/ACPM/ (branch `main`, sem etapa de build).

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
- Os testes E2E comparam a escala gerada com snapshots em `test/e2e/__snapshots__/`. Se uma mudança
  de comportamento for intencional, atualize-os com `npx playwright test --update-snapshots` e revise o diff.
- `test/fixtures/motor-goldens.json` guarda a saída do motor original para 40 cenários aleatórios e para o
  "Preencher exemplo" (gerada por `scripts/capturar-goldens-motor.mjs`).
- Os testes usam somente nomes e pesos fictícios.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Marcação das seis abas |
| `css/app.css` | Estilos e temas claro/escuro |
| `js/config.js` | Janelas, frota, missões, níveis A01–A09, limites de peso |
| `js/rules.js` | Regras das missões (Ground School, nível mínimo, precedência) |
| `js/engine.js` | Motor de alocação (função pura) |
| `js/storage.js` | Persistência (localStorage), migrações e link compartilhado |
| `js/state.js`, `js/actions.js` | Estado da aplicação e ações (perfil, desfazer, histórico, gerar escala) |
| `js/views/` | Renderização de cada aba |
| `js/export.js` | CSV e PDF |
| `js/main.js` | Eventos da interface e inicialização |

## Fluxo de trabalho

Alterações entram por branch + pull request. O GitHub Actions roda todos os testes em cada push e PR;
ao entrar na `main`, o GitHub Pages publica a nova versão.
