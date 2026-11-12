// Шов страховки входных файлов сборки (`webapp/public/asset-recovery.js`,
// инцидент 2026-11-04): на деплое /donate открылась без стилей — HTML пришёл из
// одной сборки, а /assets/index-<хеш>.css ушёл в контейнер, где такого файла
// нет, и повтора не было.
//
// Юнит (webapp/src/assetRecovery.test.ts) сам шлёт событие error и сам решает,
// где стоит тег. Здесь через шов идут те, кто делает это в проде (правило
// №14): настоящий Chromium решает, придёт ли error на упавший файл, а
// собранный Vite HTML (`vite preview` того же dist, что уезжает в прод) —
// стоит ли скрипт раньше тегов сборки. Первый запрос файла получает 404,
// следующие проходят — так выглядит деплой, когда повтор попал в контейнер с
// нужной сборкой.
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';

// /donate — публичная страница, вход не нужен. Общий `test` (support/test.ts)
// даёт стаб API формы сервера и роняет тест на отчёте клиента о сбое: «повтор
// помог — отчёта нет» держит он, а не своя копия перехвата `/api`.
test.use({ session: 'anonymous' });

/** Первый запрос подходящего файла сборки — 404, следующие — к серверу. */
async function failFirstRequest(page: Page, pathname: RegExp) {
  const seen = { requests: 0 };
  await page.route(
    (url) => pathname.test(url.pathname),
    (route) => {
      seen.requests += 1;
      return seen.requests === 1
        ? route.fulfill({ status: 404, body: 'nf' })
        : route.continue();
    },
  );
  return seen;
}

/** Сигналы «повтор помог» (asset_recovered → POST /api/public-event): только
 *  наблюдение за запросом, ответ даёт общий стаб (support/stubApi.ts). */
function collectRecoveries(page: Page) {
  const bodies: unknown[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/public-event'
    ) {
      bodies.push(request.postDataJSON());
    }
  });
  return bodies;
}

/** Загрузки документа во вкладке: перезагрузка — вторая. */
function countDocumentLoads(page: Page) {
  const loads = { count: 0 };
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      loads.count += 1;
    }
  });
  return loads;
}

test.describe('файл сборки не дошёл с первого раза', () => {
  test('стиль — запрошен снова, страница со стилями и без перезагрузки', async ({
    page,
  }) => {
    // Компьютер: на телефоне ссылка «← На главную» внизу скрыта и так.
    await page.setViewportSize({ width: 1280, height: 800 });
    const css = await failFirstRequest(page, /^\/assets\/index-[^/]+\.css$/);
    const loads = countDocumentLoads(page);
    const recoveries = collectRecoveries(page);

    await page.goto('/donate');

    // Раскладку `.ap-home` задаёт только index-*.css (auth-pay.css): на
    // компьютере inline-flex внутри flex-колонки, и браузер считает его flex;
    // без файла ссылка остаётся inline. Шапку с той же ссылкой тот же файл на
    // компьютере прячет: симптом инцидента — две видимые «← На главную».
    await expect(page.locator('a.ap-home')).toHaveCSS('display', 'flex');
    await expect(
      page.getByRole('link', { name: 'На главную', exact: true }),
    ).toHaveCount(1);
    const entryStylesheetApplied = await page.evaluate(() =>
      [...document.styleSheets].some((sheet) => {
        if (!/\/assets\/index-[^/]+\.css/.test(sheet.href ?? '')) return false;
        try {
          return sheet.cssRules.length > 0;
        } catch {
          return false; // у упавшего стиля Chromium бросает на cssRules
        }
      }),
    );
    expect(entryStylesheetApplied).toBe(true);
    await expect(page.locator('link[data-asset-retry="1"]')).toHaveCount(1);
    expect(css.requests).toBe(2);
    expect(loads.count, 'страница не перезагружалась').toBe(1);
    // Повтор помог — сигнал в /stats: настоящий Chromium шлёт load новому <link>.
    await expect
      .poll(() => recoveries)
      .toEqual([
        { name: 'asset_recovered', meta: { kind: 'css', attempts: 1 } },
      ]);
  });

  test('входной модуль — одна перезагрузка, страница рендерится', async ({
    page,
  }) => {
    const js = await failFirstRequest(page, /^\/assets\/index-[^/]+\.js$/);
    const loads = countDocumentLoads(page);
    const recoveries = collectRecoveries(page);

    await page.goto('/donate');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Поддержать проект' }),
    ).toBeVisible({ timeout: 15_000 });
    expect(loads.count, 'ровно одна перезагрузка').toBe(2);
    expect(js.requests).toBe(2);
    const stamps: unknown = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem('asset-reload-at') ?? 'null'),
    );
    expect(stamps).toHaveLength(1);
    // Перезагрузка помогла: window load после неё шлёт один сигнал js/1.
    await expect
      .poll(() => recoveries)
      .toEqual([
        { name: 'asset_recovered', meta: { kind: 'js', attempts: 1 } },
      ]);
  });
});
