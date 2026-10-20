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
//
// Стаб — общий с crisis-smoke.spec.ts (правило «одна механика — один
// компонент», см. support/stubApi.ts): оба идут через один и тот же вход
// (AuthProvider → /api/auth/refresh) и один и тот же бутстрап AppShell.
import { test, expect } from '@playwright/test';
import { stubApi, throwOnPageError } from './support/stubApi';

test.describe('браузерный smoke: приложение открывается и сохраняет оценку', () => {
  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    // Ошибки рантайма в консоли — повод упасть: «белый экран» обычно
    // начинается именно с них, а ассерты по видимым элементам могут его
    // не заметить, если проверяемый узел успел отрендериться до падения.
    throwOnPageError(page);
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

  test('трекер: оценка ставится тапом и переживает перезагрузку страницы', async ({
    page,
  }) => {
    // Единственный тест этого файла, идущий в АВТОРИЗОВАННУЮ часть — до него
    // смок проверял только публичные маршруты, а описание describe обещало
    // «сохраняет оценку» без единого теста на это (проверено при разведке).
    await page.goto('/today');

    // Бутстрап AppShell фетчит needs/ratings и держит спиннер, пока не
    // ответят все три — ждём кнопку из «Потребности сегодня», а не
    // фиксированную паузу.
    const openTracker = page.getByRole('button', { name: 'Изменить →' });
    await openTracker.waitFor();
    await openTracker.click();

    // Ни одна потребность ещё не оценена (fixture ratings пуст) — оверлей
    // открывается на первой из STUB_NEEDS («Привязанность»). Шкала —
    // единственный контрол оценки NeedScale (правило «одна механика — один
    // компонент»): десять кнопок без текста, имя каждой — aria-label
    // «N из 10». Та же шкала стоит и на «Сегодня» под оверлеем, поэтому
    // кнопку ищем внутри оверлея, иначе локатор совпал бы с шестью кнопками.
    const overlay = page.locator('.tk2-overlay');
    const rateSeven = overlay
      .getByRole('group', { name: 'Привязанность' })
      .getByRole('button', { name: '7 из 10', exact: true });
    await rateSeven.waitFor();

    const saved = page.waitForResponse(
      (res) =>
        res.url().includes('/api/rating') && res.request().method() === 'POST',
    );
    await rateSeven.click();
    await saved;

    await page.reload();

    // Возвращаемся на «Сегодня»: оценка первой потребности («attachment»)
    // должна прийти из фикстуры-стаба, куда её записал POST выше, а не
    // отрисоваться заново с нуля — сегмент «7» нажат, рядом стоит число.
    const todayScale = page.getByRole('group', { name: 'Привязанность' });
    await expect(
      todayScale.getByRole('button', { name: '7 из 10', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ct-need-row').first()).toContainText('7');
  });
});
