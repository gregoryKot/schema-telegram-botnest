// Полноэкранный лист на телефоне прокручивается до конца (инцидент 2026-11-10,
// docs/INCIDENTS.md). Лист «История» (HistorySheet: u-sheet-grid → шапка + .page)
// на ≤767 не прокручивался: правило телефона `.page { overflow: visible; height:
// auto }` (index.css) снимало прокрутку, а грид листа — fixed с overflow: hidden,
// и низ истории («Неделя» ниже второй плитки, «Карточка недели») был недоступен.
// jsdom раскладку не считает, поэтому замер — здесь, на прод-сборке: у содержимого
// листа есть своя прокрутка, и последний элемент после неё виден в окне.
import { test, expect } from './support/test';
import { localDateStr } from '../shared/src/utils/format';

const NEEDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];
const PHONES = [
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'Android 360×640', width: 360, height: 640 },
];

for (const phone of PHONES) {
  test(`${phone.name}: лист «История» прокручивается до конца`, async ({ page, api }) => {
    // Неделя оценок, сегодняшний день заполнен целиком — трекер откроется на «Готово».
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      api.ratingsByDay.set(
        localDateStr(d),
        Object.fromEntries(NEEDS.map((id, k) => [id, ((i + k) % 9) + 1])),
      );
    }
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await page.goto('/today');
    await page.getByRole('button', { name: /^Трекер/ }).click();
    await page.getByRole('button', { name: 'История →' }).click();

    const sheet = page.locator('.u-sheet-grid');
    await expect(sheet.getByRole('heading', { name: /История/ })).toBeVisible();
    await sheet.getByRole('button', { name: 'Неделя' }).click();

    const scroller = sheet.locator(':scope > .page');
    const { overflowY, scrollHeight, clientHeight } = await scroller.evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    // Неделя на телефоне длиннее окна — иначе проверка ничего не доказывает.
    expect(scrollHeight).toBeGreaterThan(clientHeight);
    expect(['auto', 'scroll']).toContain(overflowY);

    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const last = scroller.locator('*:visible').last();
    const box = await last.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(phone.height + 1);
  });
}
