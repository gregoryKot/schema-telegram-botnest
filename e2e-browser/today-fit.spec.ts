// «Сегодня» на телефоне — один экран без прокрутки (владелец 2026-11-06).
//
// На iPhone в установленном приложении страница уезжала на ~70px, и шапка
// пряталась под статус-бар: нижнее поле .ds-page стояло поверх зазора над
// панелью. Высоту считает только браузер (jsdom CSS не исполняет), поэтому
// замер — здесь, на прод-сборке. Раскладка — webapp/src/styles/client-today.css.
//
// Вырез и статус-бар Chromium не эмулирует: --safe-top/--safe-bottom ставим
// сами, значениями iPhone в standalone-режиме. Данные — самые длинные из
// обычных: имя, подпись дневника «Последняя запись — <дата>» в три строки.
import { test, expect } from './support/test';
import { FIXTURES } from './support/stubFixtures';

const PHONES = [
  {
    name: 'iPhone 15, установленное приложение',
    width: 393,
    height: 852,
    top: 59,
    bottom: 34,
  },
  {
    name: 'iPhone 13 mini, установленное приложение',
    width: 375,
    height: 812,
    top: 50,
    bottom: 34,
  },
  {
    name: 'iPhone SE, установленное приложение',
    width: 375,
    height: 667,
    top: 20,
    bottom: 0,
  },
  { name: 'Android 360×640', width: 360, height: 640, top: 0, bottom: 0 },
];

for (const phone of PHONES) {
  test(`${phone.name}: «Сегодня» без прокрутки, плитки над панелью`, async ({
    page,
    api,
  }) => {
    const profile = FIXTURES['GET /api/profile'] as Record<string, unknown>;
    api.overrides.set('GET /api/profile', { ...profile, name: 'Григорий' });
    const entryAt = new Date(Date.now() - 20 * 86_400_000).toISOString();
    api.overrides.set('GET /api/diary/gratitude', [
      {
        id: 1,
        date: entryAt.slice(0, 10),
        items: ['Тёплый чай'],
        createdAt: entryAt,
      },
    ]);

    await page.setViewportSize({ width: phone.width, height: phone.height });
    await page.goto('/today');
    // Запись в дневнике есть — лист «Зачем это всё» сам не открывается.
    await expect(page.getByText(/^Последняя запись — /)).toBeVisible();
    await page.addStyleTag({
      content: `:root { --safe-top: ${phone.top}px !important; --safe-bottom: ${phone.bottom}px !important; }`,
    });
    await page.evaluate(() => document.fonts.ready);

    const m = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
      tilesBottom: document
        .querySelector('.pp-squares')!
        .getBoundingClientRect().bottom,
      navTop: document.querySelector('.mobile-nav')!.getBoundingClientRect()
        .top,
    }));
    expect(
      m.scroll,
      'страница длиннее экрана — появилась прокрутка',
    ).toBeLessThanOrEqual(m.viewport);
    expect(
      m.tilesBottom,
      'низ плиток ушёл под нижнюю панель',
    ).toBeLessThanOrEqual(m.navTop);
  });
}
