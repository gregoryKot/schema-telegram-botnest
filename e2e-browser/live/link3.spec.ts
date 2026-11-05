import { test, expect } from '@playwright/test';
import {
  USERS,
  login,
  apiAs,
  failOnPageError,
  openSettings,
  openMore,
  openCabinetDisclaimerFree,
  nullBody,
  ensureConnected,
} from './helpers';

// Продолжение link2.spec: повторное подключение, удаление терапевтом,
// офлайн-клиент, вход по ссылке веб-клиента.
test.describe.serial('связь: жизненный цикл, часть 2', () => {
  test('8. повторное подключение по новому коду: старые заметки терапевта снова видны', async ({
    page: c,
  }) => {
    failOnPageError(c);
    const tApi = await apiAs(USERS.T);
    // Сценарий самодостаточен: связь, заметка терапевта, затем разрыв через API —
    // и подключение заново кодом через интерфейс.
    await ensureConnected();
    expect(
      (
        await tApi.post(`/api/therapy/notes/${USERS.C}`, {
          data: { date: '2026-11-01', text: 'Заметка до отвязки' },
        })
      ).status(),
    ).toBe(201);
    await (await apiAs(USERS.C)).delete('/api/therapy/relation');
    const invite = await (
      await tApi.post('/api/therapy/invite', { data: {} })
    ).json();
    await login(c, USERS.C);
    await openSettings(c);
    await c.getByLabel('Код от терапевта').fill(invite.code);
    await c.getByRole('button', { name: 'Подключиться' }).click();
    await expect(c.getByText('Отключиться от терапевта')).toBeVisible();
    const notes = await (
      await tApi.get(`/api/therapy/notes/${USERS.C}`)
    ).json();
    expect(notes.notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Заметка до отвязки' }),
      ]),
    );
    await openMore(c);
    await expect(
      c.getByText('Написать терапевту').first(),
      'после подключения кодом мост ведёт к терапевту без перезагрузки',
    ).toBeVisible({ timeout: 10_000 });
  });

  test('9. терапевт удаляет клиента: связь и заметки стёрты, у клиента задание остаётся', async ({
    page: t,
    browser,
  }) => {
    failOnPageError(t);
    await ensureConnected();
    await login(t, USERS.T);
    await openCabinetDisclaimerFree(t);
    // После повторного подключения новым кодом псевдонима «Мария К.» нет — карточка по имени аккаунта.
    await t.locator('.tc-name', { hasText: /Мария/ }).first().click();
    await t.getByRole('button', { name: 'Действия с карточкой' }).click();
    await t.getByRole('menuitem', { name: 'Удалить клиента' }).click();
    const [del] = await Promise.all([
      t.waitForResponse(
        (r) =>
          r.request().method() === 'DELETE' &&
          /\/api\/therapy\/clients\//.test(r.url()),
        { timeout: 15_000 },
      ),
      t.getByRole('button', { name: 'Удалить', exact: true }).click(),
    ]);
    expect(del.status(), 'DELETE /api/therapy/clients/:id').toBe(200);
    await expect(t.locator('.tc-name', { hasText: /Мария/ })).toHaveCount(0, {
      timeout: 10_000,
    });
    const tApi = await apiAs(USERS.T);
    expect(
      (
        (await (await tApi.get('/api/therapy/clients')).json()) as {
          telegramId: string;
        }[]
      ).map((x) => String(x.telegramId)),
    ).not.toContain(USERS.C);
    expect((await tApi.get(`/api/therapy/notes/${USERS.C}`)).status()).toBe(
      403,
    );
    const cApi = await apiAs(USERS.C);
    expect(
      await nullBody(await cApi.get('/api/therapy/relation')),
      'связи нет',
    ).toBe(true);
    const history = await (await cApi.get('/api/therapy/tasks/history')).json();
    expect(
      history.find(
        (x: { text: string }) => x.text === 'Записать три благодарности',
      ),
      'задание остаётся у клиента как история',
    ).toBeTruthy();
    const cPage = await (await browser.newContext()).newPage();
    await login(cPage, USERS.C);
    await openSettings(cPage);
    await expect(cPage.getByLabel('Код от терапевта')).toBeVisible();
  });

  test('10. офлайн-клиент: карточка, задание, переименование, удаление', async ({
    page: t,
  }) => {
    failOnPageError(t);
    await login(t, USERS.T);
    await openCabinetDisclaimerFree(t);
    const name = t.getByPlaceholder('Имя клиента, например Анна К.');
    if (!(await name.isVisible().catch(() => false)))
      await t.getByRole('button', { name: /Новый клиент/ }).click();
    await name.fill('Вера О.');
    await t.getByRole('button', { name: 'Создать карточку' }).click();
    await t.getByRole('button', { name: 'к списку' }).click();
    await expect(t.locator('.tc-name', { hasText: 'Вера О.' })).toHaveCount(1);
    const tApi = await apiAs(USERS.T);
    const clients = await (await tApi.get('/api/therapy/clients')).json();
    const offline = clients.find((x: { name: string }) => x.name === 'Вера О.');
    expect(
      String(offline.telegramId).startsWith('-'),
      'офлайн-клиент — отрицательный id',
    ).toBe(true);
    await t.locator('.tc-name', { hasText: 'Вера О.' }).first().click();
    await t.getByRole('button', { name: '+ Задание' }).first().click();
    await t.getByText('Своё задание').first().click();
    await t
      .getByPlaceholder('Например: позвонить другу раз в неделю')
      .fill('Дыхание две минуты');
    await t.getByRole('button', { name: 'Назначить задание' }).click();
    await expect
      .poll(
        async () =>
          (
            await (
              await tApi.get(`/api/therapy/tasks/client/${offline.telegramId}`)
            ).json()
          ).length,
      )
      .toBe(1);
    await t.getByRole('button', { name: 'Действия с карточкой' }).click();
    await t.getByRole('menuitem', { name: 'Переименовать' }).click();
    await t.locator('input.tk-alias-input').fill('В. О.');
    await t.getByRole('button', { name: 'OK' }).click();
    await expect(t.locator('h1.tk-name')).toHaveText('В. О.');
    await t.getByRole('button', { name: 'Действия с карточкой' }).click();
    await t.getByRole('menuitem', { name: 'Удалить клиента' }).click();
    const [del] = await Promise.all([
      t.waitForResponse(
        (r) =>
          r.request().method() === 'DELETE' &&
          /\/api\/therapy\/clients\//.test(r.url()),
        { timeout: 15_000 },
      ),
      t.getByRole('button', { name: 'Удалить', exact: true }).click(),
    ]);
    expect(del.status(), 'DELETE офлайн-клиента').toBe(200);
    await expect(t.locator('.tc-name', { hasText: 'В. О.' })).toHaveCount(0, {
      timeout: 10_000,
    });
    expect(
      (
        await tApi.get(`/api/therapy/tasks/client/${offline.telegramId}`)
      ).status(),
    ).toBe(403);
  });

  test('11. веб-клиент (без Telegram) входит по ссылке-приглашению', async ({
    page: w,
  }) => {
    failOnPageError(w);
    const tApi = await apiAs(USERS.T);
    const invite = await (
      await tApi.post('/api/therapy/invite', { data: { alias: 'Вера' } })
    ).json();
    // Повторный прогон: веб-клиент мог остаться подключённым — рвём связь через API.
    await (await apiAs(USERS.W)).delete('/api/therapy/relation');
    await login(w, USERS.W);
    await w.goto(`/today?startapp=therapy_${invite.code}`);
    await expect(w.getByText(/Анна/).first()).toBeVisible({ timeout: 15_000 });
    await w.getByRole('button', { name: 'Присоединиться' }).click();
    await expect(w.getByText('Доступ открыт')).toBeVisible();
    await w.getByRole('button', { name: 'Понятно' }).click();
    const rel = await (
      await (await apiAs(USERS.W)).get('/api/therapy/relation')
    ).json();
    expect(rel).toMatchObject({ partnerName: 'Анна', status: 'active' });
    const clients = await (await tApi.get('/api/therapy/clients')).json();
    expect(
      clients.map((x: { telegramId: string }) => String(x.telegramId)),
    ).toContain(USERS.W);
  });
});
