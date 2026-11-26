import { test, expect, type Page } from '@playwright/test';
import { USERS, login, apiAs, failOnPageError } from './helpers';

// Живой проход связи клиент↔терапевт на настоящем бэкенде и живом Postgres.
test.describe.serial('связь клиент↔терапевт', () => {
  let code = '';

  async function openMyTherapist(c: Page) {
    await c.goto('/more');
    await c.getByText('Настройки', { exact: true }).first().click();
    const nav = c.getByRole('button', { name: 'Мой терапевт' });
    if (await nav.count()) await nav.first().click();
    await expect(
      c
        .getByLabel('Код от терапевта')
        .or(c.getByText('Отключиться от терапевта')),
    ).toBeVisible();
  }

  test('1. терапевт создаёт приглашение из «Новый клиент»', async ({
    page: t,
  }) => {
    failOnPageError(t);
    await login(t, USERS.T);
    await t.goto('/cabinet');
    // Дисклеймер о приватности — один раз при первом входе в кабинет.
    const thanks = t.getByRole('button', {
      name: 'Спасибо, буду иметь в виду',
    });
    // Дисклеймер появляется эффектом после загрузки профиля — ждём его, а не проверяем «сейчас».
    if (
      await thanks.waitFor({ state: 'visible', timeout: 8_000 }).then(
        () => true,
        () => false,
      )
    ) {
      await thanks.click();
      await expect(thanks, 'дисклеймер закрывается по кнопке').toBeHidden({
        timeout: 5_000,
      });
    }
    console.log('step: disclaimer done');
    // При пустом списке форма «Новый клиент» уже открыта; иначе — кнопка.
    const name = t.getByPlaceholder('Имя клиента, например Анна К.');
    if (!(await name.isVisible().catch(() => false)))
      await t.getByRole('button', { name: /Новый клиент/ }).click();
    await name.fill('Мария К.');
    await t.getByRole('checkbox', { name: /Пригласить в приложение/ }).check();
    console.log('step: form filled');
    await t
      .getByRole('button', { name: 'Создать приглашение' })
      .click({ timeout: 10_000 });
    const codeEl = t
      .locator('code')
      .filter({ hasText: /^[0-9A-F]{12}$/ })
      .first();
    await expect(codeEl).toBeVisible();
    code = (await codeEl.textContent())!.trim();
    await t.getByRole('button', { name: 'к списку' }).click();
    await expect(t.getByText('Ждут подключения')).toBeVisible();
    await expect(t.getByText('Мария К.').first()).toBeVisible();
  });

  test('2. клиент подключается по коду в «Мой терапевт»', async ({
    page: c,
  }) => {
    failOnPageError(c);
    await login(c, USERS.C);
    await openMyTherapist(c);
    await c.getByLabel('Код от терапевта').fill(code.toLowerCase());
    await c.getByRole('button', { name: 'Подключиться' }).click();
    await expect(c.getByText(/Терапевт Анна видит/)).toBeVisible();
    await expect(c.getByText('Отключиться от терапевта')).toBeVisible();
    const api = await apiAs(USERS.C);
    const rel = await (await api.get('/api/therapy/relation')).json();
    expect(rel).toMatchObject({
      role: 'client',
      partnerName: 'Анна',
      status: 'active',
    });
  });

  test('3. терапевт видит одну карточку «Мария К.», приглашение ушло из ожидающих', async ({
    page: t,
  }) => {
    failOnPageError(t);
    await login(t, USERS.T);
    await t.goto('/cabinet');
    await expect(t.locator('.tc-name', { hasText: /Мария/ })).toHaveCount(1);
    await expect(t.getByText('Ждут подключения')).toHaveCount(0);
    const api = await apiAs(USERS.T);
    const clients = await (await api.get('/api/therapy/clients')).json();
    expect(
      clients.map((x: { telegramId: string }) => String(x.telegramId)),
    ).toContain(USERS.C);
    const data = await api.get(`/api/therapy/client-data/${USERS.C}`);
    expect(data.status()).toBe(200);
    // Второй терапевт без связи — 403.
    const other = await apiAs(USERS.T2);
    expect(
      (await other.get(`/api/therapy/client-data/${USERS.C}`)).status(),
    ).toBe(403);
    expect((await other.get(`/api/therapy/notes/${USERS.C}`)).status()).toBe(
      403,
    );
  });
});
