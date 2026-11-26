// Вложенный шит в браузере: подтверждение поверх листа настроек
// (docs/open/one-frontend.md, «Вложенный шит в axe-смоке»).
//
// Класс «два диалога на одном документе» жил на парах: оба слоя с aria-modal,
// ловушка фокуса у нижнего, Escape закрывал оба. Юниты (dialogA11y.test.tsx,
// BottomSheet.test.tsx) проверяют пару в jsdom; здесь — то же в настоящем
// браузере с собранным бандлом: «Настройки» → «Мой терапевт» → «Отключиться от
// терапевта» открывает Dialog поверх листа.
//
// Что держит: axe (wcag2a+wcag2aa) на паре — ноль нарушений (новый экран
// рождается без долга, как экраны кабинета в a11y-smoke.spec.ts); фокус внутри
// верхнего слоя и не уходит из него по Tab; Escape закрывает только верхний.
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './support/test';

test.describe('a11y: подтверждение поверх листа настроек', () => {
  test.beforeEach(async ({ page }) => {
    // Автолист «Зачем это всё» перехватывает клики — он не предмет смока.
    await page.addInitScript(() => localStorage.setItem('why_seen_v1', '1'));
  });

  test('axe без нарушений, фокус заперт в верхнем слое, Escape закрывает только его', async ({
    page,
  }) => {
    await page.goto('/today');
    await page.getByRole('link', { name: 'Ещё', exact: true }).first().click();
    await page
      .getByRole('button', { name: 'Настройки', exact: true })
      .first()
      .click();
    const nav = page.getByRole('button', { name: 'Мой терапевт', exact: true });
    if (await nav.count()) await nav.first().click();
    await page.getByLabel('Код от терапевта').fill('abcdef123456');
    await page.getByRole('button', { name: 'Подключиться' }).click();
    await page
      .getByRole('button', { name: 'Отключиться от терапевта' })
      .click();

    const confirm = page.getByRole('button', {
      name: 'Отключиться',
      exact: true,
    });
    await expect(confirm).toBeVisible();
    // Верхний слой — диалог с кнопкой, внутри которого нет другого диалога
    // (подтверждение рисуется внутри листа, оба — role="dialog").
    const top = page
      .getByRole('dialog')
      .filter({ has: confirm })
      .filter({ hasNot: page.getByRole('dialog') });
    await expect(top).toHaveCount(1);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      results.violations.map((v) => `${v.impact} ${v.id}: ${v.help}`),
    ).toEqual([]);

    const focusInTop = () =>
      top.evaluate((el) => el.contains(document.activeElement));
    await expect.poll(focusInTop).toBe(true);
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      expect(await focusInTop()).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Отключиться от терапевта' }),
    ).toBeVisible();
  });
});
