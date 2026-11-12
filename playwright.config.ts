// Playwright — только браузерный smoke (docs/TEST_TRUST_PLAN.md, п.4).
// Не «ещё один слой тестов», а страховка от класса «собралось, но не
// работает»: битый бандл, сломанный SPA-fallback, ошибка рантайма до первого
// рендера. Гоняется в PR-CI (джоба browser-smoke) и в nightly (флаки на main).
import { existsSync } from 'fs';
import { defineConfig, devices } from '@playwright/test';

// Предустановленный Chromium песочницы — по факту наличия файла (ревизия меняется с образом);
// на CI-раннере его нет, и Playwright берёт скачанный.
const PREINSTALLED_CHROMIUM = [
  '/opt/pw-browsers/chromium', // ссылка образа на текущую ревизию
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
];
const executablePath =
  process.env.PW_CHROMIUM_PATH || // локальный путь к браузеру (в CI не задан, конфиг не меняется)
  PREINSTALLED_CHROMIUM.find((p) => existsSync(p));

const commonUse = {
  trace: 'retain-on-failure' as const,
  ...devices['Desktop Chrome'],
  launchOptions: { executablePath },
};

export default defineConfig({
  testDir: './e2e-browser',
  // Смок быстрый и без ретраев: «иногда зелёный» не выдаётся за зелёный (флаки ловит nightly.yml).
  retries: 0,
  fullyParallel: false,
  reporter: [['list']],
  use: commonUse,
  // Проекты за одним CI-прогоном `npx playwright test` (nightly.yml, джоба
  // browser-smoke, без фильтра по проекту):
  //  - webapp — сайт schemehappens.ru, десктопный Chromium (a11y-smoke.spec.ts тоже: ему нужен baseURL 4173).
  projects: [
    {
      name: 'webapp',
      testMatch: [
        'crisis-smoke.spec.ts',
        'page-rhythm.spec.ts',
        'tracker-smoke.spec.ts',
        'therapy-smoke.spec.ts',
        'public-pages.spec.ts',
        'a11y-smoke.spec.ts',
        'a11y-nested-sheet.spec.ts',
        'desktop-layout.spec.ts',
        'asset-recovery.spec.ts',
        'today-fit.spec.ts',
        'tracker-fit.spec.ts',
        'screen-customize.spec.ts',
        'sheet-scroll.spec.ts',
        'wheel-fit.spec.ts',
      ],
      use: { ...commonUse, baseURL: 'http://127.0.0.1:4173' },
    },
    //  - game — тоже под этим прогоном: прод-сборка игры game/ (база /game/, сборка `npm run build --prefix game`).
    {
      name: 'game',
      testMatch: ['game-smoke.spec.ts'],
      use: { ...commonUse, baseURL: 'http://127.0.0.1:4174' },
    },
  ],
  webServer: [
    // Готовая сборка — тот артефакт, что уезжает в прод: dev прощает то, на чём спотыкается прод.
    {
      // --host 127.0.0.1: без него Vite слушает "localhost", а на раннере с IPv6 это ::1,
      // и проверка готовности в 127.0.0.1 упирается в таймаут.
      command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
      cwd: 'webapp',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    // Игра: тот же vite preview по готовому game/dist, база /game/ из game/vite.config.ts.
    {
      command: 'npx vite preview --port 4174 --strictPort --host 127.0.0.1',
      cwd: 'game',
      url: 'http://127.0.0.1:4174/game/',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
