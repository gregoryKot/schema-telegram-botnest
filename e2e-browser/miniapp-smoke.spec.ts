// Браузерный smoke НАСТОЯЩЕГО Telegram Mini App (docs/SHIELD_PROMPT.md).
//
// tracker-smoke.spec.ts/crisis-smoke.spec.ts открывают собранный webapp — сайт
// schemehappens.ru. Но продукт, который пользователь реально открывает по
// кнопке web_app в боте, — это schema-miniapp (dist закоммичен в git, Dockerfile
// его только копирует в webapp/dist/app/, см. CLAUDE.md «Деплой webapp»). Ни
// один тест до этого файла не открывал собранный schema-miniapp/dist в
// браузере — ровно на этой поверхности жил инцидент 2026-08-08
// (INCIDENT_2026-08-08_TELEGRAM_LOGIN.md): подстрока `WebAppData=` в
// max-bridge.js совпадала с телеграмным `#tgWebAppData=…`, мост MAX грузился
// у каждого пользователя Telegram, и вход не работал ПЯТЬ СУТОК ни у кого.
//
// Хост-вход — НЕ мок window.Telegram.WebApp, а настоящий запуск: страница
// открывается с URL-хэшем `#tgWebAppData=…` (support/stubMiniApp.ts,
// telegramLaunchHash), и его разбирает РЕАЛЬНЫЙ webapp/public/telegram-web-app.js
// (отдаётся support/miniappStaticServer.mjs с корня — как в проде). Мок
// объекта проверил бы только код приложения, не сам шов детекции хоста
// (shared/src/host/telegram.ts, isTelegramContext) — а инцидент жил именно в
// нём (правило №14 CLAUDE.md: «предусловие создаёт другой код — тест обязан
// пройти через него»). Заодно тест 1 — регрессия на сам инцидент: если
// max-bridge.js снова начнёт искать подстроку, он попытается догрузить чужой
// SDK с max.ru, сети в тесте нет — страница упадёт pageerror'ом.
//
// SW (registerServiceWorker) регистрируется только в web-хосте
// (registerServiceWorker.ts) — раз тест открывается как Telegram-хост, SW не
// регистрируется и мешать смоку не может, глушить его отдельно не нужно.
import { test, expect } from '@playwright/test';
import {
  CRISIS_HOTLINE_DISPLAY,
  CRISIS_HOTLINE_TEL,
} from '../shared/src/utils/crisisMarkers';
import {
  openMiniApp,
  stubMiniApi,
  throwOnPageError,
} from './support/stubMiniApp';

const CRISIS_TEXT = 'я так больше не могу, хочу умереть';

test.describe('браузерный smoke: реальный Telegram Mini App (schema-miniapp/dist)', () => {
  test.beforeEach(async ({ page }) => {
    await stubMiniApi(page);
    throwOnPageError(page);
  });

  test('открывается по настоящему Telegram-запуску и рендерит «Сегодня»', async ({
    page,
  }) => {
    await openMiniApp(page);

    // Активная нижняя вкладка при первом входе — «Сегодня» (App.tsx,
    // getInitialSection); её кнопка появляется, только когда AppShell
    // прогрузил бутстрап и хост-детекция признала Telegram.
    await expect(
      page.getByRole('button', { name: 'Сегодня', exact: true }),
    ).toBeVisible();
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('главное действие: тап по потребности сохраняет оценку и шлёт POST /api/rating', async ({
    page,
  }) => {
    await openMiniApp(page);
    await page.getByRole('button', { name: 'Сегодня', exact: true }).waitFor();

    // Главное (и единственное акцентное) действие экрана «Сегодня» —
    // HeroCta «Одно дело на сегодня» (TodayFocusCard.tsx, правило CLAUDE.md
    // «одно очевидное главное действие на экран»). NeedMini-плитки лежат под
    // прогрессивным раскрытием «Что ещё можно сегодня ⌄» — тот же переход в
    // TrackerOverlay, но с лишним шагом, а тут смок именно про главное
    // действие, а не про второстепенный путь к нему.
    await page
      .getByRole('button', { name: /Заполнить трекер потребностей/ })
      .click();

    // TrackerOverlay открылся на тапнутой потребности — оценка тапом по
    // NeedRatingBar (shared механика трекера и «Вчера»).
    const rateSeven = page.getByRole('button', { name: 'Поставить 7' });
    await rateSeven.waitFor();

    const saved = page.waitForResponse(
      (res) =>
        res.url().includes('/api/rating') && res.request().method() === 'POST',
    );
    await rateSeven.click();

    // UI отражает оценку оптимистично, до ответа сервера (aria-pressed).
    await expect(rateSeven).toHaveAttribute('aria-pressed', 'true');
    const res = await saved;
    expect(res.status()).toBeLessThan(400);
  });

  test('кризисная фраза в «Практиках» показывает карточку с телефоном доверия', async ({
    page,
  }) => {
    await openMiniApp(page);
    await page.getByRole('button', { name: 'Сегодня', exact: true }).waitFor();

    // Путь: BottomNav «Помощь» → ToolsList → «Практики» (PracticesScreen) —
    // самый дешёвый свободный текст на этом фронте, тот же компонент и та же
    // CrisisCardView, что в webapp-смоке (см. crisis-smoke.spec.ts).
    await page.getByRole('button', { name: 'Помощь' }).click();
    await page.getByRole('button', { name: /^Практики/ }).click();

    const input = page.getByPlaceholder('Добавить практику...');
    await input.waitFor();
    await input.fill(CRISIS_TEXT);

    const card = page.getByRole('status');
    await expect(card).toBeVisible();
    await expect(card).toContainText(CRISIS_HOTLINE_DISPLAY);
    await expect(card.locator(`a[href="${CRISIS_HOTLINE_TEL}"]`)).toBeVisible();
  });
});
