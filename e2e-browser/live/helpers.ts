import {
  expect,
  request,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import * as jwt from 'jsonwebtoken';

export const USERS = {
  T: '4300000000001',
  T2: '4300000000002',
  C: '4300000000003',
  C2: '4300000000004',
  W: '1000000000000042',
};

const SECRET = 'e2e-smoke-test-secret'; // test/e2e-support/env.setup.ts

export function accessToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'access' }, SECRET, {
    algorithm: 'HS256',
    expiresIn: 900,
    issuer: 'schemehappens.ru',
    audience: 'schemehappens.ru',
  });
}

/** Прямой доступ к API стенда от имени пользователя (минуя сайт). */
export async function apiAs(userId: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: 'http://localhost:3000',
    extraHTTPHeaders: {
      Authorization: `Bearer ${accessToken(userId)}`,
      'x-requested-with': 'webapp',
    },
  });
}

/** Вход на сайте через настоящую refresh-куку стенда. */
export async function login(page: Page, userId: string): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('cookie_consent', 'necessary');
    } catch {
      /* страница входа :3001 — нет доступа */
    }
  });
  await page.goto(`http://localhost:3001/login/${userId}`);
  await page.waitForURL(/localhost:5174/);
  await expect(page.locator('#root')).not.toBeEmpty();
}

export function failOnPageError(page: Page): void {
  page.on('pageerror', (err) => {
    throw new Error(`pageerror: ${err.message}`);
  });
}

// Шаги, общие для файлов жизненного цикла связи (link2/link3).
export async function openSettings(c: Page) {
  await c.goto('/more');
  await c.getByText('Настройки', { exact: true }).first().click();
  const nav = c.getByRole('button', { name: 'Мой терапевт' });
  if (await nav.count()) await nav.first().click();
}
export async function openMore(c: Page) {
  await c.getByRole('link', { name: 'Ещё' }).first().click();
  await expect(c.getByText('Зачем это всё').first()).toBeVisible();
}
export async function openCabinetDisclaimerFree(t: Page) {
  await t.goto('/cabinet');
  const thanks = t.getByRole('button', {
    name: 'Спасибо, буду иметь в виду',
  });
  if (
    await thanks.waitFor({ state: 'visible', timeout: 4_000 }).then(
      () => true,
      () => false,
    )
  ) {
    await thanks.click();
    await expect(thanks).toBeHidden();
  }
}
/** Пустой ответ Nest на null — тело ''. */
export const nullBody = async (r: { text(): Promise<string> }) => {
  const t = await r.text();
  return t === '' || t === 'null';
};
export async function ensureConnected() {
  const cApi = await apiAs(USERS.C);
  if (await nullBody(await cApi.get('/api/therapy/relation'))) {
    const invite = (await (
      await (await apiAs(USERS.T)).post('/api/therapy/invite', { data: {} })
    ).json()) as { code: string };
    expect(
      (
        await cApi.post('/api/therapy/join', { data: { code: invite.code } })
      ).status(),
    ).toBe(201);
  }
}
export const tomorrow = (days = 1) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
