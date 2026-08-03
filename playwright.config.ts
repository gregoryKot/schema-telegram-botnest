// Playwright — только браузерный smoke (docs/TEST_TRUST_PLAN.md, п.4).
// Не «ещё один слой тестов», а страховка от класса «собралось, но не
// работает»: битый бандл, сломанный SPA-fallback, ошибка рантайма до первого
// рендера. Гоняется в nightly, в PR-CI не лезет — там уже 7 джоб.
import { existsSync } from 'fs';
import { defineConfig, devices } from '@playwright/test';

// В dev-окружении Chromium предустановлен, и его ревизия может не совпасть с
// той, которую ждёт свежий @playwright/test (качать запрещено — см. правила
// окружения). На CI-раннере такого браузера нет: там Playwright ставит свой,
// и путь задавать НЕ надо. Поэтому выбираем по факту наличия файла, а не по
// флагу окружения — так конфиг работает в обоих местах без правок.
const PREINSTALLED_CHROMIUM =
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = existsSync(PREINSTALLED_CHROMIUM)
  ? PREINSTALLED_CHROMIUM
  : undefined;

export default defineConfig({
  testDir: './e2e-browser',
  // Смок обязан быть быстрым и не флакать: без ретраев, чтобы «иногда
  // зелёный» не выдавался за зелёный (правило про флаки — nightly.yml).
  retries: 0,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: { executablePath },
  },
  // Отдаём готовую сборку webapp — именно тот артефакт, который уезжает в
  // прод, а не dev-сервер с другим поведением (dev прощает то, на чём
  // спотыкается прод: другой резолв путей, отсутствие минификации).
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    cwd: 'webapp',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
