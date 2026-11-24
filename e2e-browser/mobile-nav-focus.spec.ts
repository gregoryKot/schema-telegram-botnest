// Нижнее меню телефона возвращается, когда поле с фокусом ушло из DOM (инцидент 2026-11-24,
// docs/INCIDENTS.md). MobileNav прячется, пока фокус в поле, и ждал focusout, а WebKit его не
// шлёт, если поле удалено вместе с листом: ввели имя в «Настройках», закрыли лист — меню нет.
// jsdom раскладку и поведение фокуса WebKit не повторяет, поэтому — WebKit на прод-сборке.
import { test, expect } from './support/test';

test('«Настройки»: ввели имя, закрыли лист — нижнее меню на месте', async ({
  page,
}) => {
  await page.goto('/today');
  // На чистом аккаунте сам открывается лист «Зачем это всё» и закрывает меню — закрываем его.
  await page.getByRole('button', { name: 'Понятно, начнём' }).click();
  const nav = page.locator('nav.mobile-nav');
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Ещё', exact: true }).click();
  await page
    .getByRole('button', { name: /^Настройки/ })
    .first()
    .click();

  const name = page.getByLabel('Имя', { exact: true });
  await name.click();
  await name.fill('Аня');
  await expect(nav).toHaveCount(0); // над клавиатурой меню прячется
  // Тап iOS фокус на кнопку не переводит (клик Playwright — переводит): фокус остаётся в поле,
  // пока лист не уберёт его из DOM, и focusout WebKit не шлёт.
  await page
    .locator('.st-overlay')
    .getByRole('button', { name: /Закрыть/ })
    .first()
    .evaluate((b) => (b as HTMLButtonElement).click());
  await expect(page.locator('.st-overlay')).toHaveCount(0);
  await expect(nav).toBeVisible();
});
