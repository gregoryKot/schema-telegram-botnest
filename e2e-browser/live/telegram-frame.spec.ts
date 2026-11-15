// Сайт в iframe Telegram Web — в настоящем браузере (docs/open/audit-2026-10.md:
// CSP `frame-ancestors` из src/security/embedders.ts проверен только supertest'ом;
// до аудита 2026-10-11 Telegram Web получал «Refused to frame» при ответе 200).
//
// Родитель — страница-обёртка с <iframe>, которую Playwright отдаёт сам на
// https://web.telegram.org (и на контрольном чужом хосте); сайт в iframe —
// https://schemehappens.ru, запросы к нему уходят на живой стенд :3000
// (настоящий AppModule со сборкой сайта и заголовками helmet). TLS и DNS не
// нужны: оба хоста обслуживает перехват, а CSP браузер применяет к ответу как
// к пришедшему из сети. Обёртка не сводится к «заголовок есть»: решение,
// рисовать ли кадр, принимает Chromium.
//
// Сессия во фрейме (обмен подписи → refresh) идёт мимо перехвата: iframe грузит
// стенд прямо с http://localhost:3000 (для кук localhost — защищённый контекст,
// как https). route.fetch держит куки в своей банке и обошёл бы SameSite —
// принять ли куку из кросс-сайтового ответа и вернуть ли её, решает Chromium.
import { createHmac } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Frame, Page } from '@playwright/test';
import { chromium, test, expect } from '@playwright/test';

const STAND = 'http://localhost:3000';
const SITE = 'https://schemehappens.ru';
const TG_WEB = 'https://web.telegram.org';
const TG_CLIENT = '4300000000003'; // клиент с Telegram (test/e2e-support/live-stand.ts)
const BOT_TOKEN = '12345:E2E_SMOKE_TEST_TOKEN'; // test/e2e-support/env.setup.ts

function wrapper(src: string): string {
  return `<!doctype html><html><body><iframe id="app" src="${src}" width="800" height="600"></iframe></body></html>`;
}

async function frameOf(page: Page): Promise<Frame> {
  const el = await page.locator('#app').elementHandle();
  const frame = await el.contentFrame();
  return frame!;
}

async function openInFrame(page: Page, parent: string): Promise<Frame> {
  await page.route(`https://${parent}/**`, (r) =>
    r.fulfill({ contentType: 'text/html', body: wrapper(`${SITE}/today`) }),
  );
  await page.route(`${SITE}/**`, async (r) => {
    const u = new URL(r.request().url());
    const res = await r.fetch({ url: `${STAND}${u.pathname}${u.search}` });
    await r.fulfill({ response: res });
  });
  await page.goto(`https://${parent}/k/`);
  return frameOf(page);
}

/** Стенд в iframe Telegram Web; запросы сайта — настоящие, без перехвата. */
async function standInTelegramWeb(page: Page): Promise<Frame> {
  // Родитель «из интернета» грузит кадр с localhost — без разрешения Chromium
  // режет такой кадр (Local Network Access); в проде оба хоста публичные.
  await page
    .context()
    .grantPermissions(['local-network-access'], { origin: TG_WEB });
  await page.route(`${TG_WEB}/**`, (r) =>
    r.fulfill({ contentType: 'text/html', body: wrapper(`${STAND}/today`) }),
  );
  await page.goto(`${TG_WEB}/k/`);
  const frame = await frameOf(page);
  await expect(frame.locator('#root')).not.toBeEmpty({ timeout: 30_000 });
  return frame;
}

/** initData мини-аппа, подписанная токеном бота стенда (src/auth/telegram-init-data.ts). */
function signedInitData(userId: string): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: Number(userId), first_name: 'Мария' }),
  };
  const check = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

/** POST из фрейма с заголовками сайта (refreshSession.ts): кука — на совести браузера. */
function postFromFrame(
  frame: Frame,
  path: string,
  body?: Record<string, string>,
): Promise<{ status: number; accessToken?: string }> {
  return frame.evaluate(
    async ({ path, body }) => {
      const r = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-requested-with': 'webapp',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (r.ok ? await r.json() : {}) as { accessToken?: string };
      return { status: r.status, accessToken: data.accessToken };
    },
    { path, body },
  );
}

function subjectOf(accessToken: string | undefined): string | undefined {
  const payload = accessToken?.split('.')[1];
  if (!payload) return undefined;
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
    sub?: string;
  };
  return claims.sub;
}

async function exchangeInFrame(frame: Frame, platform: string) {
  const login = await postFromFrame(frame, '/api/auth/telegram/webapp', {
    initData: signedInitData(TG_CLIENT),
    platform,
  });
  expect(login.status).toBe(200);
  expect(subjectOf(login.accessToken)).toBe(TG_CLIENT);
}

test.describe('сайт в iframe площадки (CSP frame-ancestors)', () => {
  test('web.telegram.org — кадр рисует сайт', async ({ page }) => {
    const frame = await openInFrame(page, 'web.telegram.org');
    await expect(frame.locator('#root')).not.toBeEmpty({ timeout: 30_000 });
    expect(frame.url()).toContain('schemehappens.ru');
  });

  test('контроль: чужой хост — браузер не рисует кадр', async ({ page }) => {
    const refused: string[] = [];
    page.on('console', (m) => {
      if (/frame-ancestors|Refused to frame/i.test(m.text()))
        refused.push(m.text());
    });
    const frame = await openInFrame(page, 'evil.example');
    await expect
      .poll(() => refused.length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(await frame.locator('#root').count()).toBe(0);
  });
});

// Аудит 2026-10: Sec-Fetch-Site у fetch из фрейма — same-origin, и refresh-кука
// выдавалась Strict: из кросс-сайтового iframe браузер её не возвращает.
test.describe('сессия в iframe Telegram Web (refresh-кука)', () => {
  test('weba: обмен подписи во фрейме, затем refresh — 200 и новый access', async ({
    page,
  }) => {
    const frame = await standInTelegramWeb(page);
    const exchanged = page.waitForResponse((r) =>
      r.url().endsWith('/api/auth/telegram/webapp'),
    );
    await exchangeInFrame(frame, 'weba');
    const setCookie = (await (await exchanged).allHeaders())['set-cookie'];
    const refreshLine = setCookie
      .split('\n')
      .find((l) => l.startsWith('refresh_token='));
    expect(refreshLine).toMatch(/SameSite=None/i);
    expect(refreshLine).toMatch(/Partitioned/i); // CHIPS: блокировка сторонних кук её не режет

    const renewed = await postFromFrame(frame, '/api/auth/refresh');
    expect(renewed.status).toBe(200);
    expect(subjectOf(renewed.accessToken)).toBe(TG_CLIENT);
  });

  // Контроль: тот же фрейм, но платформа без iframe (нативный клиент) — кука
  // strict, и браузер её не возвращает. Без этого зелёный тест выше мог бы
  // означать, что стенд вовсе не проверяет SameSite.
  test('контроль: ios во фрейме — strict-кука не возвращается, refresh 401', async ({
    page,
  }) => {
    const frame = await standInTelegramWeb(page);
    await exchangeInFrame(frame, 'ios');
    expect((await postFromFrame(frame, '/api/auth/refresh')).status).toBe(401);
  });

  // Сторонние куки заблокированы (настройка Chrome, Brave, инкогнито): кука
  // SameSite=None без Partitioned во фрейме не живёт, партиционированная — живёт.
  // Блокировку честно держит только профиль полного Chromium: headless shell и
  // CDP Network.setCookieControls пропускают куки ответов сервера.
  test('weba при заблокированных сторонних куках — refresh 200 (CHIPS)', async () => {
    const profile = test.info().outputPath('profile');
    mkdirSync(join(profile, 'Default'), { recursive: true });
    const prefs = { cookie_controls_mode: 1, block_third_party_cookies: true };
    writeFileSync(
      join(profile, 'Default', 'Preferences'),
      JSON.stringify({ profile: prefs }),
    );
    const ctx = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    });
    try {
      const page = ctx.pages()[0] ?? (await ctx.newPage());
      const frame = await standInTelegramWeb(page);
      // Контроль: блокировка действует — обычную стороннюю куку браузер не ставит.
      const jar = await frame.evaluate(() => {
        document.cookie = 'probe_3pc=1; SameSite=None; Secure; Path=/';
        return document.cookie;
      });
      expect(jar).not.toContain('probe_3pc');

      await exchangeInFrame(frame, 'weba');
      const renewed = await postFromFrame(frame, '/api/auth/refresh');
      expect(renewed.status).toBe(200);
    } finally {
      await ctx.close();
    }
  });
});
