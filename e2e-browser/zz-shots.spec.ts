import { test, expect } from './support/test';
import { asTherapist, OFFLINE_CLIENT } from './support/therapistCabinet';

const PREFIX = process.env.SHOT_PREFIX ?? 'after';
const DIR = '/tmp/claude-0/-home-user-schema-telegram-botnest/608d5d90-a783-5c91-ad94-2adf302d2da2/scratchpad/shots';
test.use({ locale: 'en-US', deviceScaleFactor: 2 });

for (const [w, h] of [[375, 812], [1280, 800]]) {
  test(`dates ${w}`, async ({ page, api }) => {
    await page.setViewportSize({ width: w, height: h });
    await asTherapist(page, api);
    await page.goto(`/cabinet/${OFFLINE_CLIENT.urlCode}`);
    await expect(page.getByRole('heading', { name: 'Следующая сессия' })).toBeVisible();
    const card = page.locator('.tk-meet-row', { has: page.getByRole('heading', { name: 'Следующая сессия' }) });
    await card.getByRole('button', { name: /Изменить|Указать/ }).click();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await card.screenshot({ path: `${DIR}/${PREFIX}-nextsession-${w}.png` });
    await page.screenshot({ path: `${DIR}/${PREFIX}-nextsession-${w}-page.png` });
    const info = await card.locator('input, button, [role=button]').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return `${e.tagName}:${(e as HTMLInputElement).type ?? ''}:${Math.round(r.width)}x${Math.round(r.height)}`; }));
    console.log(PREFIX, w, JSON.stringify(info));
    const start = page.locator('.tk-meet-row', { has: page.getByRole('heading', { name: 'Начало терапии' }) });
    await start.getByRole('button', { name: /Изменить|Указать/ }).click();
    await start.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await start.screenshot({ path: `${DIR}/${PREFIX}-start-${w}.png` });
  });
}
