// Ключевые экраны на iPhone 13 в WebKit снимком в каждом PR (проект webkit-iphone, артефакт
// `phone-screens` джобы browser-smoke): вид на айфоне виден без устройства. Сверки с эталоном нет.
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './support/test';
import { asTherapist, OFFLINE_CLIENT } from './support/therapistCabinet';

// Снимок — видимая область: на длинном снимке закреплённая нижняя панель рисуется посреди страницы.
async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await expect(page.locator('.skel')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath(`phone-${name}.png`),
    animations: 'disabled', // иначе в кадр попадает середина появления раздела
  });
}

test.beforeEach(async ({ page }) => {
  // Новичку лист «Зачем это всё» открывается сам и закрывает экран.
  await page.addInitScript(() => localStorage.setItem('why_seen_v1', '1'));
});

test('«Сегодня»', async ({ page }, testInfo) => {
  await page.goto('/today');
  await expect(page.getByRole('button', { name: /^Трекер/ })).toBeVisible();
  await shoot(page, testInfo, 'today');
});

test('«Записи»', async ({ page }, testInfo) => {
  await page.goto('/diary');
  await expect(page.getByRole('heading', { name: 'Что было' })).toBeVisible();
  await shoot(page, testInfo, 'diary');
});

test('лист записи: первый шаг', async ({ page }, testInfo) => {
  await page.goto('/diary');
  await page.getByRole('button', { name: 'Записать' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Дневник' })
      .getByRole('heading', { name: 'Что на уме?' }),
  ).toBeVisible();
  await shoot(page, testInfo, 'entry');
});

test('кабинет терапевта: клиентов ещё нет', async ({ page, api }, testInfo) => {
  await asTherapist(page, api);
  api.overrides.set('GET /api/therapy/clients', []);
  await page.goto('/cabinet');
  await expect(page.getByRole('heading', { name: 'Клиенты' })).toBeVisible();
  await shoot(page, testInfo, 'therapist');
});

// Кабинет с офлайн-клиентом (support/therapistCabinet.ts). «Графические карты» на телефоне —
// строка «откройте на компьютере» вместо холста (modeMap/ModeMapTab.tsx).
const CARD = `/cabinet/${OFFLINE_CLIENT.urlCode}`;
const CABINET = [
  {
    title: 'список клиентов',
    shot: 'therapist-clients',
    path: '/cabinet',
    ready: (p: Page) =>
      p.getByRole('button', { name: new RegExp(OFFLINE_CLIENT.name) }),
  },
  {
    title: '«Обзор» клиента',
    shot: 'therapist-client',
    path: CARD,
    ready: (p: Page) => p.getByRole('heading', { name: 'Следующая сессия' }),
  },
  {
    title: '«Графические карты»',
    shot: 'therapist-maps',
    path: `${CARD}/maps`,
    ready: (p: Page) =>
      p.getByText(/^Графические карты открываются на компьютере/),
  },
];

for (const s of CABINET) {
  test(`кабинет терапевта: ${s.title}`, async ({ page, api }, testInfo) => {
    await asTherapist(page, api);
    await page.goto(s.path);
    await expect(s.ready(page)).toBeVisible();
    await shoot(page, testInfo, s.shot);
  });
}
