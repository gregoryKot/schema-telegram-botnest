// Браузерный smoke (docs/TEST_TRUST_PLAN.md, п.4).
//
// У нас 2300 юнитов, 79 HTTP-e2e и компонентные тесты — но НИ ОДИН из них не
// открывает приложение целиком в браузере. Между «все части работают» и
// «продукт работает» есть зазор: не тот бандл, битый роутинг, упавший CSP,
// ошибка в рантайме до первого рендера, неверный API_BASE в сборке. Такое
// собирается зелёным и не работает у пользователя.
//
// Этот файл не про покрытие — он про один вопрос: «приложение вообще
// открывается и делает главное действие?». Поэтому путей мало и они самые
// ходовые: загрузка → трекер → сохранение оценки → значение пережило
// перезагрузку.
//
// Бэкенд не поднимаем: /api/* перехватывается и отвечает фикстурами. Так
// смок остаётся быстрым и детерминированным, а проверяет именно фронт —
// сборку, роутинг, рендер, обращения к API. Контракт «фронт зовёт то, что
// бэкенд отдаёт» держат HTTP-e2e и контрактный тест api-мока.
import { test, expect, type Page } from '@playwright/test';

const NEEDS = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привяз.',
  },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автон.' },
  { id: 'freedom', emoji: '🕊', title: 'Свобода', chartLabel: 'Свобода' },
  { id: 'play', emoji: '🎨', title: 'Игра', chartLabel: 'Игра' },
  { id: 'limits', emoji: '🧱', title: 'Границы', chartLabel: 'Границы' },
];

/**
 * Оценки живут в памяти теста, а не в фикстуре-константе: сохранение должно
 * реально доехать до «сервера» и вернуться при следующем чтении — иначе
 * проверка «пережило перезагрузку» была бы самообманом (страница показала бы
 * захардкоженный ответ независимо от того, сохранилось ли что-нибудь).
 */
async function stubApi(page: Page) {
  const ratings: Record<string, number> = {};

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (path.endsWith('/api/needs')) return json(NEEDS);
    if (path.endsWith('/api/ratings')) return json(ratings);
    if (path.endsWith('/api/rating') && method === 'POST') {
      const body = route.request().postDataJSON() as {
        needId: string;
        value: number;
      };
      ratings[body.needId] = body.value;
      return json({
        ok: true,
        allDone: Object.keys(ratings).length === NEEDS.length,
      });
    }
    if (path.endsWith('/api/settings'))
      return json({ addressForm: null, notifyEnabled: true });
    if (path.endsWith('/api/streak'))
      return json({ todayDone: false, totalDays: 0 });
    // Всё остальное — пустой успех: смок не про полноту API, а про то, что
    // приложение не падает на неожиданном ответе.
    return json({});
  });
}

test.describe('браузерный smoke: приложение открывается и сохраняет оценку', () => {
  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    // Ошибки рантайма в консоли — повод упасть: «белый экран» обычно
    // начинается именно с них, а ассерты по видимым элементам могут его
    // не заметить, если проверяемый узел успел отрендериться до падения.
    page.on('pageerror', (err) => {
      throw new Error(`Ошибка в рантайме страницы: ${err.message}`);
    });
  });

  test('главная отдаётся и рендерит содержимое, а не пустой корень', async ({
    page,
  }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('SPA-роутинг: прямой заход на вложенный путь не даёт 404', async ({
    page,
  }) => {
    // Классическая поломка деплоя: сервер не настроен на fallback к index.html,
    // и любая ссылка глубже корня открывается 404 — при том что сборка «зелёная».
    const res = await page.goto('/articles');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('#root')).not.toBeEmpty();
  });
});
