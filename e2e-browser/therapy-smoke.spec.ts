// Браузерный смок связи клиент ↔ терапевт (PR-CI и nightly, /api/** — стаб).
//
// Регрессия, найденная 2026-11-05 на живом стенде: после «Отключиться от
// терапевта» в «Ещё» оставалась строка «Написать терапевту» (устаревший кэш в
// localStorage), а после подключения по коду она не появлялась без перезагрузки.
// Юниты видят кэш и экран по отдельности — стык «сохранил → показал» проверяет
// только целое приложение.
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { activeTask, doneTask, openClientTasks } from './support/clientTasks';

const WRITE = 'Написать терапевту';
const TALK = 'Поговорить с кем-то';
const CODE_INPUT = 'Код от терапевта';

/** Задание терапевта в форме ответа GET /api/therapy/tasks(/history) — UserTask. */
const task = (id: number, text: string, done: boolean | null) => ({
  id,
  userId: '1',
  assignedBy: '2',
  type: 'custom',
  text,
  targetDays: null,
  needId: null,
  dueDate: null,
  done,
  completedAt: done === null ? null : '2026-11-05T10:00:00.000Z',
  createdAt: '2026-11-04T08:00:00.000Z',
});
const OPEN_TASK = task(1, 'Записать три благодарности', null);
const CLOSED_TASK = task(2, 'Заметить одну потребность за день', true);

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
    // Автолист «Зачем это всё» (новичку без истории) перехватывает клики — он не предмет смока.
    await page.addInitScript(() => localStorage.setItem('why_seen_v1', '1'));
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

  // Тот же путь, что у живого link2.spec (тест 5): переедет список заданий —
  // краснеет здесь, в PR, а не ночью (ci-alarm #965).
  test('задание терапевта — в «Ещё» → «Задания» с пометкой, выполненное — в «Выполнено»', async ({
    page,
    api,
  }) => {
    api.overrides.set('GET /api/therapy/tasks', [OPEN_TASK]);
    api.overrides.set('GET /api/therapy/tasks/history', [CLOSED_TASK]);
    await openClientTasks(page);
    const open = activeTask(page, OPEN_TASK.text);
    await expect(open).toBeVisible();
    await expect(open.getByText('от терапевта')).toBeVisible();
    await expect(doneTask(page, CLOSED_TASK.text)).toContainText('Выполнено');
    await expect(activeTask(page, CLOSED_TASK.text)).toHaveCount(0);
    await expect(doneTask(page, OPEN_TASK.text)).toHaveCount(0);
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
