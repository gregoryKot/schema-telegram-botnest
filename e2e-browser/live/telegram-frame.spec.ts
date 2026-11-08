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
import type { Frame, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

const STAND = 'http://localhost:3000';
const SITE = 'https://schemehappens.ru';

async function openInFrame(page: Page, parent: string): Promise<Frame> {
  await page.route(`https://${parent}/**`, (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><iframe id="app" src="${SITE}/today" width="800" height="600"></iframe></body></html>`,
    }),
  );
  await page.route(`${SITE}/**`, async (r) => {
    const u = new URL(r.request().url());
    const res = await r.fetch({ url: `${STAND}${u.pathname}${u.search}` });
    await r.fulfill({ response: res });
  });
  await page.goto(`https://${parent}/k/`);
  const el = await page.locator('#app').elementHandle();
  const frame = await el.contentFrame();
  return frame!;
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
