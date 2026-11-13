// Ключевые экраны на iPhone 13 в WebKit снимком в каждом PR (проект webkit-iphone, артефакт
// `phone-screens` джобы browser-smoke): вид на айфоне виден без устройства. Сверки с эталоном нет.
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './support/test';
import { FIXTURES } from './support/stubFixtures';

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

test('кабинет терапевта', async ({ page, api }, testInfo) => {
  // Роль поверх профиля чистого клиента и пустой кабинет — как в sheet-scroll.spec.ts.
  const profile = FIXTURES['GET /api/profile'] as Record<string, unknown>;
  api.overrides.set('GET /api/profile', { ...profile, role: 'THERAPIST' });
  api.overrides.set('GET /api/therapy/clients', []);
  api.overrides.set('GET /api/therapy/invites', []);
  api.overrides.set('GET /api/therapy/card-claims', []);
  api.overrides.set('GET /api/therapy/tasks/all', []);
  api.overrides.set('POST /api/therapy/therapist-view', { ok: true });
  await page.addInitScript(() =>
    localStorage.setItem('therapist_privacy_disclaimer_seen', '1'),
  );
  await page.goto('/cabinet');
  await expect(page.getByRole('heading', { name: 'Клиенты' })).toBeVisible();
  await shoot(page, testInfo, 'therapist');
});
