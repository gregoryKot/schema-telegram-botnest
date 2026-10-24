// Браузерный smoke публичных страниц (docs/TEST_TRUST_PLAN.md, п.4).
//
// Продолжение tracker-smoke: там проверяется, что приложение вообще
// поднимается, здесь — что каждая публичная страница открывается прямой
// ссылкой и рендерит содержимое. Именно прямой заход ломается чаще всего:
// внутри приложения переход работает (роутер уже загружен), а ссылка из
// поисковика или мессенджера упирается в 404 или белый экран.
//
// Юнит-тесты этого не ловят в принципе: они рендерят компонент, минуя
// сборку, роутер и сервер статики.
import { test, expect } from '@playwright/test';

// Публичные маршруты из webapp/src/App.tsx (personalRoutes). Юридические
// страницы включены намеренно: на них ведут ссылки из платёжной формы, и их
// недоступность блокирует оплату.
const PUBLIC_ROUTES = [
  { path: '/', name: 'лендинг' },
  { path: '/articles', name: 'список статей' },
  { path: '/reviews', name: 'отзывы' },
  { path: '/subscribe', name: 'подписка' },
  { path: '/donate', name: 'пожертвование' },
  { path: '/privacy', name: 'политика конфиденциальности' },
  { path: '/offer', name: 'оферта' },
];

test.describe('браузерный smoke: публичные страницы открываются прямой ссылкой', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      // Бэкенда нет — отвечаем пустым успехом. Страница обязана открыться
      // даже так: контент, который не пришёл, — не повод для белого экрана.
      await page.route('**/api/**', (r) =>
        r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{}',
        }),
      );

      const res = await page.goto(route.path);
      expect(res?.status(), `HTTP-статус ${route.path}`).toBeLessThan(400);
      await expect(page.locator('#root')).not.toBeEmpty();
      // Ошибка рантайма — то, с чего начинается белый экран у пользователя.
      expect(errors, `ошибки рантайма на ${route.path}`).toEqual([]);
    });
  }

  test('несуществующий путь уводит на реальный экран, а не в пустоту', async ({
    page,
  }) => {
    await page.route('**/api/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    const unknown = '/nesuschestvuyuschiy-put-12345';
    const res = await page.goto(unknown);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('#root')).not.toBeEmpty();
    // В App.tsx два набора маршрутов: на персональном домене '*' ведёт на
    // '/', в приложении — на '/today'. Конкретный адрес зависит от хоста,
    // поэтому проверяем сам факт: редирект случился и мы не остались на
    // несуществующем пути с пустым экраном.
    await page.waitForURL((url) => url.pathname !== unknown);
  });
});

// Регрессия 2026-09-16 (визитка kotlarewski.gr перед рекламной кампанией):
// обёртка лендинга с overflowX: hidden внутри #root { display: flex; height:
// 100vh } растягивалась на высоту экрана и становилась внутренним скроллером.
// Страница «листалась», но window.scrollY оставался 0 — липкая панель с кнопкой
// «Записаться», прогресс-бар и подсветка разделов не включались никогда.
// jsdom раскладку не считает — это ловит только настоящий браузер.
test.describe('визитка практики: прокручивается окно, а не внутренний блок', () => {
  test('после прокрутки window.scrollY > 0 и липкая панель показана', async ({
    page,
  }) => {
    await page.route('**/api/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.goto('/?site=personal', { waitUntil: 'networkidle' });
    await page.evaluate(() =>
      localStorage.setItem('cookie_consent', 'necessary'),
    );
    const viewport = page.viewportSize()!;
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, viewport.height * 2);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 })
      .toBeGreaterThan(viewport.height);
    // Липкая панель: fixed-блок высотой 58px с кнопкой «Записаться» уезжает
    // за верхний край (translateY(-100%)) пока не прокрутили 75% экрана.
    const bar = page.locator(
      'div[style*="position: fixed"][style*="height: 58px"]',
    );
    await expect(bar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    await expect(bar.getByRole('button', { name: 'Записаться' })).toBeVisible();
    // Горизонтального переполнения нет: обёртка не шире окна.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
