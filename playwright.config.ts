// Playwright — только браузерный smoke (docs/TEST_TRUST_PLAN.md, п.4).
// Не «ещё один слой тестов», а страховка от класса «собралось, но не
// работает»: битый бандл, сломанный SPA-fallback, ошибка рантайма до первого
// рендера. Гоняется в nightly, в PR-CI не лезет — там уже 7 джоб.
import { existsSync } from 'fs';
import { defineConfig, devices, webkit } from '@playwright/test';

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

// Тот же приём для WebKit (аудит тестовых практик, п.2: iOS-Телеграм и MAX —
// это WKWebView, движок Safari; до этого CI ни разу не проверял мобильную
// половину аудитории). В dev-окружении WebKit НЕ предустановлен и качать его
// нельзя (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1) — `webkit.executablePath()`
// резолвит путь ожидаемой ревизии из node_modules, а существует он на диске
// только там, где `playwright install webkit` реально отработал (CI). Флаг
// PW_WEBKIT=1 — запасной путь для окружений, где бинарь лежит нестандартно
// (второй способ включения, как просит задание), но основной сигнал — факт
// наличия файла, а не переменная окружения.
function webkitBinaryExists(): boolean {
  try {
    return existsSync(webkit.executablePath());
  } catch {
    return false;
  }
}
const WEBKIT_AVAILABLE = process.env.PW_WEBKIT === '1' || webkitBinaryExists();

// Общее для webapp/miniapp — только браузер/трейс отличается baseURL.
const commonUse = {
  trace: 'retain-on-failure' as const,
  ...devices['Desktop Chrome'],
  launchOptions: { executablePath },
};

// Мобильный профиль мини-аппа (аудит, п.2): мини-апп mobile-first, а смок до
// сих пор гонял его десктопным вьюпортом — цели нажатия ≥44×44 (правило
// CLAUDE.md) никто не проверял в реальных пропорциях экрана. `devices['iPhone
// 14']` даёт нужные viewport/UA/touch, НО заодно тащит свой
// `defaultBrowserType: 'webkit'` — если его не перебить явно, вьюпорт
// незаметно переключит движок с Chromium (и executablePath выше окажется
// путём к чужому браузеру). Возвращаем `chromium` явно: мобильный вьюпорт
// нужен независимо от WebKit-проекта ниже, тот добавляется отдельно.
const miniappMobileUse = {
  ...commonUse,
  ...devices['iPhone 14'],
  defaultBrowserType: 'chromium' as const,
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
  // Проекты — разные продукты/движки за одним CI-прогоном `npx playwright
  // test` (nightly.yml, джоба browser-smoke, без фильтра по проекту):
  //  - webapp — сайт schemehappens.ru, десктопный Chromium (существующие
  //    смоки не меняли; a11y-smoke.spec.ts добавлен — там же лежат страницы
  //    webapp, которым нужен baseURL 4173);
  //  - miniapp — Telegram Mini App schemehappens.ru/app/ в Chromium, но
  //    ТЕПЕРЬ мобильным профилем (iPhone 14 viewport/UA/touch) — мини-апп
  //    mobile-first, а смок до аудита 2026-08 гонял его десктопным вьюпортом;
  //  - miniapp-webkit — тот же мини-апп, но движком Safari (WKWebView): и
  //    iOS-Телеграм, и MAX рендерят мини-аппы именно им, а Chromium его не
  //    ловит в принципе. Добавляется только когда бинарь реально доступен
  //    (см. WEBKIT_AVAILABLE выше) — локально в этом dev-окружении его нет
  //    и проект тихо отсутствует в списке (не «скип каждого теста», а
  //    отсутствие самого проекта: `npx playwright test` не пытается его
  //    поднять и не падает на отсутствующем браузере).
  projects: [
    {
      name: 'webapp',
      testMatch: [
        'crisis-smoke.spec.ts',
        'tracker-smoke.spec.ts',
        'public-pages.spec.ts',
        'a11y-smoke.spec.ts',
      ],
      use: { ...commonUse, baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'miniapp',
      testMatch: ['miniapp-smoke.spec.ts', 'a11y-smoke.spec.ts'],
      use: { ...miniappMobileUse, baseURL: 'http://127.0.0.1:4174' },
    },
    ...(WEBKIT_AVAILABLE
      ? [
          {
            name: 'miniapp-webkit',
            testMatch: ['miniapp-smoke.spec.ts'],
            use: {
              ...devices['iPhone 14'],
              baseURL: 'http://127.0.0.1:4174',
              trace: 'retain-on-failure' as const,
              // Никакого launchOptions.executablePath: тут нужен настоящий
              // WebKit из ревизии @playwright/test, а не Chromium-бинарь
              // выше — CI ставит его сам (`playwright install webkit`).
            },
          },
        ]
      : []),
  ],
  webServer: [
    // Отдаём готовую сборку webapp — именно тот артефакт, который уезжает в
    // прод, а не dev-сервер с другим поведением (dev прощает то, на чём
    // спотыкается прод: другой резолв путей, отсутствие минификации).
    {
      command: 'npx vite preview --port 4173 --strictPort',
      cwd: 'webapp',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    // Мини-апп: свой статик-сервер, не `vite preview` — прод раздаёт мини-апп
    // и корневые /telegram-web-app.js, /max-bridge.js ОДНИМ ServeStaticModule
    // (src/app.module.ts), а `vite preview` из schema-miniapp отдал бы только
    // /app/ и 404-ил бы оба корневых скрипта (см. support/miniappStaticServer.mjs).
    {
      command: 'node e2e-browser/support/miniappStaticServer.mjs',
      url: 'http://127.0.0.1:4174/app/',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
