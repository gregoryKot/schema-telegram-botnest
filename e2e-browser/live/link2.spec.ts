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
  tomorrow,
} from './helpers';

// Продолжение link.spec: C уже подключена к T. Приватность, задания, встреча,
// отвязка клиентом. Дальше — link3.spec (повторное подключение, удаление,
// офлайн-клиент, веб-клиент по ссылке).
test.describe.serial('связь: жизненный цикл', () => {
  let taskId = 0;

  test('4. тумблер «Дневники и карточки» закрывает дневник от терапевта', async ({
    page: c,
  }) => {
    failOnPageError(c);
    const cApi = await apiAs(USERS.C);
    const tApi = await apiAs(USERS.T);
    const created = await cApi.post('/api/diary/gratitude', {
      data: { date: tomorrow(1 + (Date.now() % 300)), items: ['тёплое утро'] },
    });
    expect(created.status(), 'запись благодарности создана').toBe(201);
    let diary = await (
      await tApi.get(`/api/therapy/client/${USERS.C}/diary`)
    ).json();
    expect(diary.length, 'по умолчанию терапевт видит дневник').toBeGreaterThan(
      0,
    );
    await login(c, USERS.C);
    await openSettings(c);
    await c
      .getByRole('switch', { name: 'Дневники и карточки' })
      .or(c.getByRole('button', { name: 'Дневники и карточки' }))
      .first()
      .click();
    await expect
      .poll(
        async () =>
          (
            await (
              await tApi.get(`/api/therapy/client/${USERS.C}/diary`)
            ).json()
          ).length,
        { timeout: 10_000 },
      )
      .toBe(0);
    // Обратно — снова видно.
    await c
      .getByRole('switch', { name: 'Дневники и карточки' })
      .or(c.getByRole('button', { name: 'Дневники и карточки' }))
      .first()
      .click();
    await expect
      .poll(
        async () =>
          (
            await (
              await tApi.get(`/api/therapy/client/${USERS.C}/diary`)
            ).json()
          ).length,
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
    diary = await (
      await tApi.get(`/api/therapy/client/${USERS.C}/diary`)
    ).json();
    expect(diary[0]).toMatchObject({ type: 'gratitude' });
  });

  test('5. терапевт назначает задание из карточки → клиент видит «от терапевта»', async ({
    page: t,
    browser,
  }) => {
    failOnPageError(t);
    await login(t, USERS.T);
    await openCabinetDisclaimerFree(t);
    await t.locator('.tc-name', { hasText: /Мария/ }).first().click();
    await t.getByRole('button', { name: '+ Задание' }).first().click();
    await t.getByText('Своё задание').first().click();
    await t
      .getByPlaceholder('Например: позвонить другу раз в неделю')
      .fill('Записать три благодарности');
    await t.getByRole('button', { name: 'Назначить задание' }).click();
    const tApi = await apiAs(USERS.T);
    await expect
      .poll(async () => {
        const tasks = await (
          await tApi.get(`/api/therapy/tasks/client/${USERS.C}`)
        ).json();
        const mine = tasks.find(
          (x: { text: string }) => x.text === 'Записать три благодарности',
        );
        taskId = mine?.id ?? 0;
        return taskId;
      })
      .toBeGreaterThan(0);
    const cPage = await (await browser.newContext()).newPage();
    await login(cPage, USERS.C);
    await cPage.goto('/today');
    await expect(
      cPage.getByText('Записать три благодарности').first(),
    ).toBeVisible();
    await expect(cPage.getByText('от терапевта').first()).toBeVisible();
    // Клиент выполняет — терапевт видит выполнение.
    const cApi = await apiAs(USERS.C);
    expect(
      (
        await cApi.post(`/api/therapy/tasks/${taskId}/complete`, {
          data: { done: true },
        })
      ).status(),
    ).toBe(201);
    await expect
      .poll(async () => {
        const tasks = await (
          await tApi.get(`/api/therapy/tasks/client/${USERS.C}`)
        ).json();
        return tasks.find((x: { id: number }) => x.id === taskId)?.done;
      })
      .toBe(true);
    // Выполненное не считается активным на «Сегодня» клиента.
    await cPage.reload();
    await expect(cPage.getByText('Трекер').first()).toBeVisible();
    await expect(cPage.getByText('1 активное')).toHaveCount(0);
  });

  test('6. терапевт ставит следующую сессию → клиент видит её в профиле', async ({
    page: t,
    browser,
  }) => {
    failOnPageError(t);
    await login(t, USERS.T);
    await openCabinetDisclaimerFree(t);
    await t.locator('.tc-name', { hasText: /Мария/ }).first().click();
    await t.getByRole('button', { name: 'Изменить →' }).first().click();
    await t.getByLabel('День сессии').fill(tomorrow());
    await t.getByRole('button', { name: 'Сохранить' }).first().click();
    const cApi = await apiAs(USERS.C);
    await expect
      .poll(
        async () =>
          (await (await cApi.get('/api/therapy/relation')).json()).nextSession,
      )
      .toBe(tomorrow());
    const cPage = await (await browser.newContext()).newPage();
    await login(cPage, USERS.C);
    await cPage.goto('/profile');
    await expect(cPage.getByText('Следующая сессия').first()).toBeVisible();
  });

  test('7. клиент отключается: терапевт теряет доступ, «Написать терапевту» исчезает', async ({
    page: c,
  }) => {
    failOnPageError(c);
    const tApi = await apiAs(USERS.T);
    await ensureConnected();
    expect(
      (
        await tApi.post(`/api/therapy/notes/${USERS.C}`, {
          data: { date: '2026-11-01', text: 'Заметка до отвязки' },
        })
      ).status(),
    ).toBe(201);
    await login(c, USERS.C);
    await openMore(c);
    await expect(
      c.getByText('Написать терапевту').first(),
      'до отвязки — ссылка на терапевта',
    ).toBeVisible();
    await openSettings(c);
    await c.getByRole('button', { name: 'Отключиться от терапевта' }).click();
    await c.getByRole('button', { name: 'Отключиться', exact: true }).click();
    await expect(c.getByLabel('Код от терапевта')).toBeVisible();
    expect(
      await nullBody(await (await apiAs(USERS.C)).get('/api/therapy/relation')),
      'связи нет',
    ).toBe(true);
    expect((await tApi.get(`/api/therapy/notes/${USERS.C}`)).status()).toBe(
      403,
    );
    expect(
      (
        (await (await tApi.get('/api/therapy/clients')).json()) as {
          telegramId: string;
        }[]
      ).map((x) => String(x.telegramId)),
    ).not.toContain(USERS.C);
    // Мост «Поговорить» после отвязки ведёт к автору, а не к бывшему терапевту.
    await openMore(c);
    await expect(
      c.getByText('Поговорить с кем-то').first(),
      'после отвязки ссылки на терапевта нет',
    ).toBeVisible({ timeout: 10_000 });
  });
});
