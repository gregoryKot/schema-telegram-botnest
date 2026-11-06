// Playwright — только браузерный smoke (docs/TEST_TRUST_PLAN.md, п.4).
// Не «ещё один слой тестов», а страховка от класса «собралось, но не
// работает»: битый бандл, сломанный SPA-fallback, ошибка рантайма до первого
// рендера. Гоняется в PR-CI (джоба browser-smoke) и в nightly (флаки на main).
import { existsSync } from 'fs';
import { defineConfig, devices } from '@playwright/test';

// В dev-окружении Chromium предустановлен, и его ревизия может не совпасть с
// той, которую ждёт свежий @playwright/test (качать запрещено — см. правила
// окружения). На CI-раннере такого браузера нет: там Playwright ставит свой,
// и путь задавать НЕ надо. Поэтому выбираем по факту наличия файла, а не по
// флагу окружения — так конфиг работает в обоих местах без правок.
const PREINSTALLED_CHROMIUM =
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
// PW_CHROMIUM_PATH — локальный путь к браузеру (в CI не задан, конфиг не меняется).
const executablePath =
  process.env.PW_CHROMIUM_PATH ||
  (existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined);

// Общие настройки проектов.
const commonUse = {
  trace: 'retain-on-failure' as const,
  ...devices['Desktop Chrome'],
  launchOptions: { executablePath },
};

export default defineConfig({
  testDir: './e2e-browser',
  // Смок обязан быть быстрым и не флакать: без ретраев, чтобы «иногда
  // зелёный» не выдавался за зелёный (правило про флаки — nightly.yml).
  retries: 0,
  fullyParallel: false,
  reporter: [['list']],
  use: commonUse,
  // Проекты за одним CI-прогоном `npx playwright test` (nightly.yml, джоба
  // browser-smoke, без фильтра по проекту):
  //  - webapp — сайт schemehappens.ru, десктопный Chromium (a11y-smoke.spec.ts
  //    лежит там же: ему нужен baseURL 4173).
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
        'asset-recovery.spec.ts',
        'today-fit.spec.ts',
        'screen-customize.spec.ts',
      ],
      use: { ...commonUse, baseURL: 'http://127.0.0.1:4173' },
    },
  ],
  webServer: [
    // Отдаём готовую сборку webapp — именно тот артефакт, который уезжает в
    // прод, а не dev-сервер с другим поведением (dev прощает то, на чём
    // спотыкается прод: другой резолв путей, отсутствие минификации).
    {
      // --host 127.0.0.1 — без него Vite биндится на "localhost" и Node сам
      // резолвит адрес через dns.lookup(); на раннере с включённым IPv6 это
      // "localhost" → "::1", а readiness-проверка ниже стучится строго в
      // 127.0.0.1 (IPv4) — сервер поднимается и работает, просто не на том
      // адресе, поэтому npx playwright test молча упирается в таймаут 60с
      // (несовпадение подтверждено на самом раннере: он живёт на другом хосте,
      // чем dev-песочница агента, и там localhost резолвится в IPv6 первым —
      // правило №14 CLAUDE.md, совпадение по факту, а не по имени). Явный
      // хост убирает резолвинг целиком.
      command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
      cwd: 'webapp',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
