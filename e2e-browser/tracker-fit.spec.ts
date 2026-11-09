// Вопрос трекера на телефоне: все пять ответов — на первом экране (ревью g2 r3,
// docs/design/APP_2026-11.md, раздел b07, принцип 5).
//
// Лист потребности над вопросом вырос до 241px (знак отдельным рядом над
// названием), и на 390×844 «Полностью» уходил под сгиб (низ ≈ 892), а в
// Telegram со своей шапкой — две верхние ступени шкалы. Высоту считает только
// браузер (jsdom CSS не исполняет), поэтому замер — здесь, на прод-сборке.
// Раскладка — webapp/src/styles/tracker-question.css (≤560px).
import { test, expect } from './support/test';

// Обычный вопрос (не первый раз: строки «откуда это» над листом нет).
const PHONE = { width: 390, height: 844, fold: 830 };

test(`вопрос трекера ${PHONE.width}×${PHONE.height}: пятый ответ выше ${PHONE.fold}`, async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('tracker_onboarding_v1', '1');
  });
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height });
  await page.goto('/today');
  // На чистом аккаунте сам открывается лист «Зачем это всё» — закрываем его.
  await page.getByRole('button', { name: 'Понятно, начнём' }).click();
  await page.getByRole('button', { name: /^Трекер/ }).click();
  const answers = page.locator('.tk2-overlay .tq-ask').getByRole('button', {
    name: / из 10$/,
  });
  await expect(answers).toHaveCount(5);
  await page.evaluate(() => document.fonts.ready);

  const sheet = await page.locator('.tq-sheet').boundingBox();
  const last = await answers.nth(4).boundingBox();
  expect(last, 'пятый ответ не найден').not.toBeNull();
  expect(
    last!.y + last!.height,
    `низ пятого ответа под сгибом (лист потребности ${Math.round(sheet?.height ?? 0)}px)`,
  ).toBeLessThanOrEqual(PHONE.fold);
});
