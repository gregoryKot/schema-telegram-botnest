// Кабинет в кадре Telegram при тёмной теме. Палитру Telegram приложение не читает: тёмный атрибут на
// <html> даёт сохранённый `app_theme`, кабинет возвращает светлую — после их встречи текст обязан читаться.
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/test';

const WRAPPER = 'https://web.telegram.org';
const FRAME = { width: 390, height: 844 };
// Параметры запуска читает настоящий /telegram-web-app.js из адреса кадра; подписи
// (tgWebAppData) нет — вход идёт по куке, как у остальных спеков на общем стабе.
const LAUNCH = new URLSearchParams({
  tgWebAppVersion: '8.0',
  tgWebAppPlatform: 'weba',
  tgWebAppThemeParams: JSON.stringify({
    bg_color: '#212121',
    secondary_bg_color: '#0f0f0f',
    text_color: '#ffffff',
    hint_color: '#aaaaaa',
  }),
});

type FrameWindow = Window & {
  themeLog?: (string | null)[];
  Telegram?: { WebApp?: { colorScheme?: string; platform?: string } };
};

// Окно выше кадра; системная схема тёмного клиента тоже тёмная. Разрешение — иначе Chromium
// не пускает кадр с публичного хоста обёртки на 127.0.0.1 (Local Network Access).
test.use({
  viewport: { width: 1280, height: 900 },
  colorScheme: 'dark',
  permissions: ['local-network-access'],
});

test('кабинет в кадре Telegram с тёмной темой: текст читается, вбок не уезжает', async ({
  page,
  baseURL,
}, testInfo) => {
  await page.addInitScript(() => {
    if (window === window.top) return;
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('why_seen_v1', '1'); // без автолиста «Зачем это всё»
    // Кабинет вернёт светлую тему: что тёмная была, видно только по истории атрибута.
    const log: (string | null)[] = [];
    (window as FrameWindow).themeLog = log;
    new MutationObserver(() =>
      log.push(document.documentElement.getAttribute('data-theme')),
    ).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  });
  // Обёртку с <iframe> отдаёт сам Playwright, как в live/telegram-frame.spec.ts.
  await page.route(`${WRAPPER}/**`, (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body style="margin:0;background:#212121"><iframe id="app" src="${baseURL}/today#${LAUNCH}" width="${FRAME.width}" height="${FRAME.height}" style="border:0"></iframe></body></html>`,
    }),
  );
  await page.goto(`${WRAPPER}/a/`);

  const frame = page.frame({ url: /\/today/ });
  if (!frame) throw new Error('кадр с кабинетом не открылся');
  await expect(frame.getByRole('button', { name: /^Трекер/ })).toBeVisible();
  await expect(frame.locator('.spinner, .skel')).toHaveCount(0);
  await frame.waitForLoadState('networkidle');
  await page
    .locator('#app')
    .screenshot({ path: testInfo.outputPath('phone-telegram-dark.png') });

  const m = await frame.evaluate(() => {
    const w = window as FrameWindow;
    return {
      platform: w.Telegram?.WebApp?.platform,
      telegram: w.Telegram?.WebApp?.colorScheme,
      themes: w.themeLog,
      width: window.innerWidth,
      scroll: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  // Без этих трёх проверять нечего: кадр — не Telegram или тёмной темы в нём не было.
  expect(m.platform, 'кадр не считает себя открытым в Telegram').toBe('weba');
  expect(m.telegram, 'тёмная палитра Telegram не дошла до SDK').toBe('dark');
  expect(m.themes, 'тёмный атрибут на <html> кадра не ставился').toContain(
    'dark',
  );

  const axe = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze();
  const checked = axe.passes
    .flatMap((p) => p.nodes)
    .filter((n) => n.target[0] === '#app');
  expect(checked.length, 'axe не проверил текст в кадре').toBeGreaterThan(0);
  expect(
    axe.violations.flatMap((v) => v.nodes).map((n) => JSON.stringify(n.target)),
    'текст в кадре не читается (color-contrast)',
  ).toEqual([]);

  expect(m.width, 'ширина кадра').toBe(FRAME.width);
  expect(m.scroll, 'горизонтальная прокрутка в кадре').toBeLessThanOrEqual(0);
});
