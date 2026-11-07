import { test, expect } from '@playwright/test';
import {
  USERS,
  login,
  apiAs,
  failOnPageError,
  openSettings,
  openCabinetDisclaimerFree,
} from './helpers';

// Живой проход «офлайн-клиент → приглашение из карточки → одна карточка»:
// терапевт завёл карточку без аккаунта, записал в неё заметку,
// концептуализацию, карту режимов и задание, потом позвал человека в
// приложение из этой карточки (OfflineInviteCard). После подключения по коду
// в кабинете одна карточка с именем из офлайн-карточки, и всё записанное
// читается по id аккаунта (therapy-invite-attach.ts). Не зависит от
// link*.spec: свои клиент (C2) и карточка; C2 отвязывается на старте.
test.describe.serial('офлайн-клиент: приглашение из карточки', () => {
  const NAME = 'Лев К.';
  let code = '';
  let offlineId = '';

  test('12. терапевт зовёт офлайн-клиента в приложение из его карточки', async ({
    page: t,
  }) => {
    failOnPageError(t);
    const tApi = await apiAs(USERS.T);
    const c2Api = await apiAs(USERS.C2);
    // Чистый старт: C2 без связи, старой карточки «Лев К.» нет.
    await c2Api.delete('/api/therapy/relation');
    const before = (await (await tApi.get('/api/therapy/clients')).json()) as {
      telegramId: string | number;
      name: string;
      clientAlias: string | null;
    }[];
    for (const c of before)
      if (c.name === NAME || c.clientAlias === NAME)
        await tApi.delete(`/api/therapy/clients/${c.telegramId}`);

    await login(t, USERS.T);
    await openCabinetDisclaimerFree(t);
    const name = t.getByPlaceholder('Имя клиента, например Анна К.');
    if (!(await name.isVisible().catch(() => false)))
      await t.getByRole('button', { name: /Новый клиент/ }).click();
    await name.fill(NAME);
    await t.getByRole('button', { name: 'Создать карточку' }).click();
    await t.getByRole('button', { name: 'к списку' }).click();
    await expect(t.locator('.tc-name', { hasText: NAME })).toHaveCount(1);

    const clients = (await (await tApi.get('/api/therapy/clients')).json()) as {
      telegramId: string | number;
      name: string;
    }[];
    offlineId = String(clients.find((x) => x.name === NAME)!.telegramId);
    expect(offlineId.startsWith('-'), 'офлайн-клиент — отрицательный id').toBe(
      true,
    );
    // Данные офлайн-периода — через API (их UI проверяют link3/link2).
    for (const [path, data] of [
      [
        `/api/therapy/notes/${offlineId}`,
        { date: '2026-10-01', text: 'первая встреча' },
      ],
      [
        `/api/therapy/conceptualization/${offlineId}`,
        { earlyExperience: 'ранний опыт' },
      ],
      [`/api/therapy/mode-maps/${offlineId}`, { title: 'карта Льва' }],
      [
        '/api/therapy/tasks',
        {
          type: 'custom',
          text: 'дыхание две минуты',
          clientId: Number(offlineId),
        },
      ],
    ] as const) {
      const r = await tApi.post(path, { data });
      expect(r.status(), `${path} → ${await r.text()}`).toBeLessThan(300);
    }

    await t.locator('.tc-name', { hasText: NAME }).first().click();
    await expect(t.locator('h1.tk-name')).toHaveText(NAME);
    await t.getByRole('button', { name: 'Пригласить в приложение' }).click();
    const codeEl = t
      .locator('code')
      .filter({ hasText: /^[0-9A-F]{12}$/ })
      .first();
    await expect(codeEl).toBeVisible({ timeout: 10_000 });
    code = (await codeEl.textContent())!.trim();
    await expect(t.getByText(/Ждёт подключения/)).toBeVisible();
    // Тот же код — и в блоке «Ждут подключения» с пометкой офлайн-карточки.
    await t.getByRole('button', { name: '← Все клиенты' }).click();
    await expect(t.getByText('Ждут подключения')).toBeVisible();
    await expect(t.getByText(/Офлайн-карточка/).first()).toBeVisible();
    await expect(t.getByText(code).first()).toBeVisible();
  });

  test('13. клиент подключается по коду из карточки', async ({ page: c }) => {
    failOnPageError(c);
    await login(c, USERS.C2);
    await openSettings(c);
    await c.getByLabel('Код от терапевта').fill(code);
    await c.getByRole('button', { name: 'Подключиться' }).click();
    await expect(c.getByText(/Терапевт Анна видит/)).toBeVisible();
    const api = await apiAs(USERS.C2);
    const rel = await (await api.get('/api/therapy/relation')).json();
    expect(rel).toMatchObject({ role: 'client', status: 'active' });
  });

  test('14. у терапевта одна карточка «Лев К.» с данными офлайн-периода', async ({
    page: t,
  }) => {
    failOnPageError(t);
    await login(t, USERS.T);
    await openCabinetDisclaimerFree(t);
    await expect(t.locator('.tc-name', { hasText: NAME })).toHaveCount(1);
    await expect(t.getByText('Ждут подключения')).toHaveCount(0);
    const api = await apiAs(USERS.T);
    const clients = (await (await api.get('/api/therapy/clients')).json()) as {
      telegramId: string | number;
      clientAlias: string | null;
    }[];
    const lev = clients.filter((x) => x.clientAlias === NAME);
    expect(lev).toHaveLength(1);
    expect(String(lev[0].telegramId)).toBe(USERS.C2);
    expect(clients.map((x) => String(x.telegramId))).not.toContain(offlineId);
    // Всё, что записано в офлайн-карточку, читается по id аккаунта.
    const notes = await (
      await api.get(`/api/therapy/notes/${USERS.C2}`)
    ).json();
    expect(JSON.stringify(notes)).toContain('первая встреча');
    const concept = await (
      await api.get(`/api/therapy/conceptualization/${USERS.C2}`)
    ).json();
    expect(concept).toMatchObject({ earlyExperience: 'ранний опыт' });
    const maps = await (
      await api.get(`/api/therapy/mode-maps/${USERS.C2}`)
    ).json();
    expect(JSON.stringify(maps)).toContain('карта Льва');
    const tasks = await (
      await api.get(`/api/therapy/tasks/client/${USERS.C2}`)
    ).json();
    expect(JSON.stringify(tasks)).toContain('дыхание две минуты');
    // Чужой терапевт — 403.
    const other = await apiAs(USERS.T2);
    expect((await other.get(`/api/therapy/notes/${USERS.C2}`)).status()).toBe(
      403,
    );
    // Карточка открывается, плашки «офлайн» нет.
    await t.locator('.tc-name', { hasText: NAME }).first().click();
    await expect(t.locator('h1.tk-name')).toHaveText(NAME);
    await expect(
      t.locator('.tk-head .ds-badge', { hasText: 'офлайн' }),
    ).toHaveCount(0);
  });
});
