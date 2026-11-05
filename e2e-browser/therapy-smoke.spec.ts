// Браузерный смок связи клиент ↔ терапевт (nightly, /api/** — стаб).
//
// Регрессия, найденная 2026-11-05 на живом стенде: после «Отключиться от
// терапевта» в «Ещё» оставалась строка «Написать терапевту» (устаревший кэш в
// localStorage), а после подключения по коду она не появлялась без перезагрузки.
// Юниты видят кэш и экран по отдельности — стык «сохранил → показал» проверяет
// только целое приложение.
import { test, expect, type Page } from '@playwright/test';
import { stubApi, throwOnPageError } from './support/stubApi';

const WRITE = 'Написать терапевту';
const TALK = 'Поговорить с кем-то';
const CODE_INPUT = 'Код от терапевта';

async function openMore(page: Page) {
  await page.getByRole('link', { name: 'Ещё', exact: true }).first().click();
  await expect(page.getByText('Всё остальное').first()).toBeVisible();
}

async function openSettings(page: Page) {
  await page
    .getByRole('button', { name: 'Настройки', exact: true })
    .first()
    .click();
  const nav = page.getByRole('button', { name: 'Мой терапевт', exact: true });
  if (await nav.count()) await nav.first().click();
}

async function closeSettings(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByLabel(CODE_INPUT)).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Отключиться от терапевта' }),
  ).toBeHidden();
}

test.describe.configure({ mode: 'serial' });

test.describe('браузерный smoke: связь с терапевтом', () => {
  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    // Автолист «Зачем это всё» (новичку без истории) перехватывает клики — он не предмет смока.
    await page.addInitScript(() => localStorage.setItem('why_seen_v1', '1'));
    throwOnPageError(page);
  });

  test('подключение по коду и отключение сразу видны в «Ещё», без перезагрузки', async ({
    page,
  }) => {
    await page.goto('/today');
    await openMore(page);
    await expect(page.getByText(TALK).first()).toBeVisible();
    await expect(page.getByText(WRITE)).toHaveCount(0);

    // Код с пробелами и в нижнем регистре — нормализация до отправки.
    await openSettings(page);
    await page.getByLabel(CODE_INPUT).fill(' abcdef123456 ');
    await page.getByRole('button', { name: 'Подключиться' }).click();
    await expect(page.getByText(/Терапевт Анна видит/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Отключиться от терапевта' }),
    ).toBeVisible();

    // Регрессия: кэш обновился на подключении.
    await closeSettings(page);
    await openMore(page);
    await expect(page.getByText(WRITE).first()).toBeVisible();

    // Регрессия: кэш очищен на отключении.
    await openSettings(page);
    await page
      .getByRole('button', { name: 'Отключиться от терапевта' })
      .click();
    await page
      .getByRole('button', { name: 'Отключиться', exact: true })
      .click();
    await expect(page.getByLabel(CODE_INPUT)).toBeVisible();
    await closeSettings(page);
    await openMore(page);
    await expect(page.getByText(TALK).first()).toBeVisible();
    await expect(page.getByText(WRITE)).toHaveCount(0);
  });

  test('неверный код: ошибка видна, связи нет', async ({ page }) => {
    await page.goto('/today');
    await openSettings(page);
    await page.getByLabel(CODE_INPUT).fill('ZZZZZZZZZZZZ');
    await page.getByRole('button', { name: 'Подключиться' }).click();
    await expect(page.locator('.st-err').first()).not.toBeEmpty();
    await expect(page.getByLabel(CODE_INPUT)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Отключиться от терапевта' }),
    ).toHaveCount(0);
  });
});
