import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'test/e2e',
  // Snapshots sem sufixo de plataforma: o texto da escala deve ser idêntico em macOS e Linux (CI)
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No CI um snapshot ausente é falha (localmente ele é criado na primeira execução)
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure'
  },
  // PW_CHANNEL=chrome usa o Google Chrome instalado em vez do Chromium baixado pelo Playwright
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined } }],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI
  }
});
