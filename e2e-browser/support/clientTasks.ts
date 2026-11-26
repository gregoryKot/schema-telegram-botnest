// Путь клиента к заданиям — один на браузерный смок (PR-CI, стаб API,
// therapy-smoke.spec.ts) и живой проход (nightly, e2e-browser/live/link2.spec.ts).
// Инцидент ci-alarm #965: PR #941 перенёс задания с «Сегодня» в «Ещё» →
// «Задания», смок PR-CI к заданиям не ходил, а живой спек искал их на /today и
// покраснел только ночью. Переедет список снова — краснеет смок в PR, и правка
// здесь чинит оба прогона.
import { expect, type Locator, type Page } from '@playwright/test';

/** «Ещё» → строка «Задания» (useMoreRows) → список TasksHub / AllTasksOverlay. */
export async function openClientTasks(page: Page): Promise<void> {
  await page.goto('/more');
  // Заголовок строки — «Задания» и, если есть новые, счётчик в том же span
  // (MoreRows, U2): textContent «Задания2», поэтому exact-поиск по тексту мимо.
  await page
    .locator('.ds-list-title', { hasText: /^Задания\d*$/ })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Задания', exact: true }),
  ).toBeVisible();
}

/** Строка активного задания (TaskRow): текст, «от терапевта», «Готово». */
export const activeTask = (page: Page, text: string): Locator =>
  page.locator('.sk-overlay .cp-task', { hasText: text });

/** Строка группы «Выполнено» — закрытые задания из /api/therapy/tasks/history. */
export const doneTask = (page: Page, text: string): Locator =>
  page.locator('.sk-overlay .sk-task.is-past', { hasText: text });
