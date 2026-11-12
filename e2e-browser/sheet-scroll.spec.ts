// Полноэкранный лист на телефоне прокручивается до конца (инцидент 2026-11-09,
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
  test(`${phone.name}: лист «История» прокручивается до конца`, async ({
    page,
    api,
  }) => {
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
    const { overflowY, scrollHeight, clientHeight } = await scroller.evaluate(
      (el) => ({
        overflowY: getComputedStyle(el).overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }),
    );
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

// «Справочник» терапевта прокручивается на планшете и компьютере (редизайн 2026-11, b35).
// Раздел рисовал .ds-page прямо в .canvas (overflow: hidden) без .page: на ≥768 колесо не
// двигало страницу, группы ниже окна («Здоровые режимы») были недоступны; на телефоне
// прокрутка была (там листает окно). Замер тот же: у раздела есть своя прокрутка, и
// последняя строка после колеса мыши видна в окне.
const WIDE = [
  { name: 'планшет 768', width: 768, height: 1024 },
  { name: 'компьютер 1280', width: 1280, height: 800 },
];

// Сессия терапевта поверх чистого клиента: роль в профиле (полная форма UserProfile)
// и пустой кабинет — списки без строк (src/api/therapy*.controller.ts).
const THERAPIST: [string, unknown][] = [
  [
    'GET /api/profile',
    {
      name: 'Терапевт',
      role: 'THERAPIST',
      ysq: { completedAt: null, activeSchemaIds: [] },
      notifications: {
        enabled: true,
        reminderEnabled: true,
        timezone: 'Europe/Moscow',
        localHour: 21,
      },
      streak: 0,
      lastActivity: {
        needsTracker: null,
        schemaDiary: null,
        modeDiary: null,
        gratitudeDiary: null,
      },
      mySchemaIds: [],
      myModeIds: [],
      unreadableLists: [],
    },
  ],
  ['GET /api/therapy/clients', []],
  ['GET /api/therapy/invites', []],
  ['GET /api/therapy/card-claims', []],
  ['GET /api/therapy/tasks/all', []],
  ['POST /api/therapy/therapist-view', { ok: true }],
];

for (const size of WIDE) {
  test(`${size.name}: «Справочник» терапевта прокручивается до последней группы`, async ({
    page,
    api,
  }) => {
    for (const [key, body] of THERAPIST) api.overrides.set(key, body);
    await page.addInitScript(() => {
      localStorage.setItem('why_seen_v1', '1');
      localStorage.setItem('therapist_privacy_disclaimer_seen', '1');
    });
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto('/cabinet/guide');
    await expect(
      page.getByRole('heading', { name: 'Справочник' }),
    ).toBeVisible();
    const last = page.getByRole('button', { name: 'Хороший Родитель' });
    await expect(last).toBeAttached();

    const scroller = page.locator('.canvas .page');
    await expect(scroller).toBeVisible();
    const { overflowY, scrollHeight, clientHeight } = await scroller.evaluate(
      (el) => ({
        overflowY: getComputedStyle(el).overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }),
    );
    // Режимов больше, чем входит в окно, — иначе проверка ничего не доказывает.
    expect(scrollHeight).toBeGreaterThan(clientHeight);
    expect(['auto', 'scroll']).toContain(overflowY);

    await page.mouse.move(size.width - 200, size.height / 2);
    await page.mouse.wheel(0, scrollHeight);
    await expect(last).toBeInViewport({ ratio: 1 });
  });
}
