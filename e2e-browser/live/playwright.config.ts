// Живой проход связи клиент↔терапевт: настоящий AppModule на живом Postgres
// (test/e2e-support/live-stand.ts, :3000 + вход :3001) и прод-сборка сайта на
// :5174 с прокси /api (webapp/vite.live.config.ts). Гоняется ночью — джоба
// `browser-live` в nightly.yml; рецепт локального запуска в шапке live-stand.ts.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: [['list']],
  outputDir: '../../test-results/live',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Локальный Chromium другой ревизии — тот же переключатель, что у основного конфига.
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    },
  },
});
