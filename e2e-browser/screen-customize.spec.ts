// «Настроить экран» на собранном сайте (#922): скрыл все блоки → закрыл лист →
// блоки пропали → перезагрузил → всё ещё скрыты, и настройка дошла до
// «сервера», не стерев ключи с другого устройства. По каждому экрану с
// настройкой — «Профиль», «Паттерны» (обе вкладки), «Практика» → «Инструменты»
// — на телефоне и на десктопе.
//
// Юниты настройки были зелёными, а скрытые блоки возвращались: они стояли по
// обе стороны шва (лист пишет localStorage; синхронизатор применяет ответ
// сервера), а не на нём. Шов — перезагрузка раньше пуша: пуш ждёт окно
// debounce 1.5 с, а старт страницы применяет серверную копию (server wins),
// которая правки ещё не видела. Поэтому перезагрузка здесь — сразу после
// «Готово», без ожидания, а «сервер» (support/stubSettings.ts) держит uiPrefs
// в памяти теста, чистит их настоящим sanitizeUiPrefs и заменяет целиком.
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/test';
import type { StubApiHandle } from './support/stubApi';

// Настройка, сделанная на другом устройстве: обязана пережить чужую правку.
// Ключ — из тех, что сервер синхронизирует (SYNCED_PREF_KEYS): ключи главной
// (screen_order_today и соседи) #969 убрал, санитайзер стаба их выбрасывает.
const OTHER_DEVICE = {
  why_seen_v1: '1',
};

interface Screen {
  name: string;
  path: string;
  open: string; // кнопка листа в шапке
  key: string; // ключ uiPrefs, куда ложатся скрытые
  tab?: string; // вкладка «Паттернов» (только телефон)
  phoneOnly?: boolean;
  /** Данные клиента поверх чистого аккаунта (форма сервера), без которых блоков экрана нет. */
  setup?: (api: StubApiHandle) => void;
  blocks: (page: Page) => Locator[]; // что видно до и не видно после
}

const SCREENS: Screen[] = [
  {
    name: '«Профиль»',
    path: '/profile',
    open: 'Настроить экран',
    key: 'screen_hidden_profile',
    // Чистый аккаунт видит пустой профиль — лист начала пути без блоков (b21, isFreshProfile): три отмеченных дня.
    setup: (api) =>
      api.overrides.set('GET /api/streak', {
        currentStreak: 1,
        longestStreak: 2,
        totalDays: 3,
        todayDone: true,
        weekDots: [true, true, false, false, false, false, false],
      }),
    blocks: (p) => [
      p.getByRole('heading', { name: 'Мой путь', level: 2 }),
      p.getByRole('heading', { name: 'Мой портрет' }),
      p.getByRole('heading', { name: 'Достижения' }),
      p.getByText('пн', { exact: true }), // неделя в карточке серии
    ],
  },
  {
    name: '«Паттерны» → «Схемы»',
    path: '/schemas',
    open: 'Настроить экран',
    key: 'screen_hidden_patterns',
    // Под вводной «Узнать свои схемы» второго входа в тест нет (ysqEntryLook → 'hidden',
    // webapp/src/sections/schemas/patternsHero.ts, ревью g5 r1): кнопка теста — на самой вводной.
    blocks: (p) => [p.getByText('Узнать свои схемы')],
  },
  {
    name: '«Паттерны» → «Режимы»',
    path: '/schemas',
    open: 'Настроить экран',
    key: 'screen_hidden_patterns',
    tab: 'Режимы',
    phoneOnly: true, // на десктопе у вкладки «Режимы» нет своей подсказки сверху
    blocks: (p) => [p.getByText('Встретить своего Критика')],
  },
  {
    name: '«Практика» → «Инструменты»',
    path: '/practice',
    open: 'Настроить инструменты',
    key: 'quick_actions_hidden_tools',
    blocks: (p) => [
      p.getByText('Проверка убеждения', { exact: true }),
      p.getByText('Безопасное место', { exact: true }),
      p.getByText('Колесо детства', { exact: true }),
      p.getByRole('heading', { name: 'Мои цели' }),
      // «Каталоги» не пропадают целиком: «Карта режимов» — их строка без пункта в «Инструментах» (b14).
      p.getByText('Что питает', { exact: true }),
      p.getByText('Планы', { exact: true }),
    ],
  },
];

async function openScreen(page: Page, s: Screen, api: StubApiHandle) {
  s.setup?.(api);
  await page.goto(s.path);
  if (s.tab) await page.getByRole('tab', { name: s.tab }).click();
}

/** Лист: выключить каждый показанный блок; возвращает, сколько выключено. */
async function hideAll(page: Page, s: Screen): Promise<number> {
  await page.getByRole('button', { name: s.open }).click();
  const switches = page.getByRole('switch');
  await expect(switches.first()).toBeVisible(); // лист грузится отдельным чанком
  let n = 0;
  for (const sw of await switches.all()) {
    if ((await sw.getAttribute('aria-checked')) !== 'true') continue;
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    n++;
  }
  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(switches).toHaveCount(0);
  return n;
}

async function expectShown(page: Page, s: Screen, shown: boolean) {
  for (const block of s.blocks(page)) {
    if (shown) await expect(block.first()).toBeVisible();
    else await expect(block).toHaveCount(0);
  }
}

/** «Сервер» хранит все скрытые блоки экрана и не потерял чужие ключи. */
async function expectSaved(api: StubApiHandle, s: Screen, hidden: number) {
  await expect
    .poll(() => JSON.parse(api.settings.uiPrefs[s.key] ?? '[]').length)
    .toBe(hidden);
  expect(api.settings.uiPrefs).toMatchObject(OTHER_DEVICE);
}

const VIEWPORTS = [
  { name: 'телефон', phone: true, viewport: { width: 390, height: 844 } },
  { name: 'десктоп', phone: false, viewport: { width: 1280, height: 800 } },
];

for (const vp of VIEWPORTS) {
  test.describe(`«Настроить экран», ${vp.name}`, () => {
    test.use({ viewport: vp.viewport });

    for (const s of SCREENS.filter((x) => vp.phone || !x.phoneOnly)) {
      test(`${s.name}: скрыл → пропало → сразу перезагрузил → скрыто`, async ({
        page,
        api,
      }) => {
        api.settings.uiPrefs = { ...OTHER_DEVICE };
        await openScreen(page, s, api);
        await expectShown(page, s, true); // контроль: без него «пропало» доказывает пустой экран
        const hidden = await hideAll(page, s);
        expect(hidden).toBeGreaterThan(0);
        await expectShown(page, s, false);

        await page.reload(); // раньше окна debounce: пуш мог не уйти
        await expect(page.getByRole('button', { name: s.open })).toBeVisible();
        await expectShown(page, s, false);
        await expectSaved(api, s, hidden);
      });
    }
  });
}

test.describe('«Настроить экран»: сервер не принял запись', () => {
  test.use({ viewport: VIEWPORTS[0].viewport });

  test('«Профиль»: пуш упал → после перезагрузки скрыто, правка дослана', async ({
    page,
    api,
  }) => {
    const s = SCREENS[0];
    api.settings.uiPrefs = { ...OTHER_DEVICE };
    api.settings.failWrites = true;
    await openScreen(page, s, api);
    await expectShown(page, s, true);
    const hidden = await hideAll(page, s);
    await expect
      .poll(() => api.settings.uiPrefsPosts.length)
      .toBeGreaterThan(0);
    expect(api.settings.uiPrefs).toEqual(OTHER_DEVICE); // сервер правку не видел

    api.settings.failWrites = false;
    await page.reload();
    await expect(page.getByRole('button', { name: s.open })).toBeVisible();
    await expectShown(page, s, false);
    await expectSaved(api, s, hidden);
  });
});
