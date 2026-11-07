// Автоматика доступности (аудит тестовых практик, п.4 — см. постановку
// задачи в докстроке миграции этого файла в истории git).
//
// До этого файла у продукта был только ручной хелпер (webapp/src/utils/a11y.ts,
// реэкспорт shared/src/utils/a11y) и точечный `role="alert"` в кризисной
// карточке — ни одного автоматического прогона против движка axe-core не
// было, при заявленной нейроинклюзивности продукта (правило CLAUDE.md про
// скелетоны/онбординг говорит именно об этом на словах).
//
// Ноль нарушений axe на живом продукте — недостижимая и бесполезная планка:
// сторонние виджеты и дизайн-компромиссы всегда что-то накопят. Поэтому здесь
// не «нуль или красный», а ХРАПОВИК в стиле остальных гейтов проекта
// (scripts/*-baseline.json): число нарушений на экран может только убывать,
// рост — красный тест. Бейслайн лежит рядом отдельным JSON (a11y-baseline.json),
// а не зашит в код — так дифф PR читаем: видно, какой экран стал хуже/лучше.
//
// Отдельное, более строгое правило — impact:'critical'. Эти нарушения ВСЕГДА
// красные и вне бейслайна: критическая проблема (например, элемент управления
// совсем не виден скринридеру) не «копится», её чинят сразу. Если легитимный
// случай всё же нужно заморозить — он попадает поимённо в FROZEN_CRITICAL
// с комментарием-причиной, чтобы это было видно в дифф-ревью (правило №15
// CLAUDE.md: «исключение — только с обоснованием»); сейчас список пуст.
//
// Экраны кабинета (/today, /diary) — инцидент 2026-11-05 (docs/INCIDENTS.md):
// в кабинете внутри Telegram текст без явного `color` был светлым на светлой
// бумаге. `.light-lock` переопределял токены, но унаследованный от body цвет
// тёмной темы (`html[data-theme="dark"]`, его ставят App.tsx по
// `localStorage.app_theme === 'dark'` и тумблер лендинга) проникал внутрь.
// Ни один vitest-тест каскад не считает, поэтому класс «унаследованный цвет не
// совпадает с токенами поддерева» ловит только настоящий браузер: axe
// (`color-contrast`) по кабинету в трёх состояниях — чистом, с тёмной темой в
// localStorage до загрузки (путь App.tsx) и с тёмным атрибутом на <html> уже
// после отрисовки (путь тумблера лендинга в SPA-сессии; держит правило CSS
// отдельно от layout-эффекта AppShell).
//
// Регрессионная сверка при написании (main после #941, убраны фиксы #929
// как на 1999a510): без правила `.light-lock { color }` и без
// `useCabinetLightTheme` в AppShell оба тёмных состояния «/practice» красные —
// `color-contrast` (serious) на заголовке «От терапевта», строке задания и
// подписях `.cp-top-line`; с одним хуком, без правила CSS, красно только
// «тёмный атрибут после отрисовки»; с обоими — ноль. «/today» (после #941
// без блока заданий) и «/diary» на том же дереве зелёные во всех состояниях:
// их текст уже красится явно (`.pp-paper`, #921), — экраны держат храповик
// каждый для себя. Поэтому у экранов кабинета бейслайн 0 и держится нулём:
// рост здесь — возврат инцидента, а не «долг».
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
// Стаб API и проверка на падение — общий `test` (support/test.ts): снимок axe
// с экрана падения ничего не доказывает, а у экрана ошибки роутера есть <h1>,
// и «страница отрисовалась» он проходит — до ci-alarm #903 /articles под
// ответом `{}` падал в «Что-то пошло не так», и храповик сверял его.
import type { StubApiHandle } from './support/stubApi';
import { test, expect } from './support/test';

const BASELINE_PATH = join(__dirname, 'a11y-baseline.json');
const baseline: Record<string, number> = JSON.parse(
  readFileSync(BASELINE_PATH, 'utf8'),
);
// Замороженные ИМЕНОВАННЫЕ критические нарушения (правило №15 CLAUDE.md) —
// сейчас пусто: честный прогон на момент написания теста не нашёл ни одного.
// Если появится легитимный случай — добавляй сюда `screenId: ['rule-id']` с
// комментарием-причиной, а не расширяй общий бейслайн числом.
const FROZEN_CRITICAL: Record<string, string[]> = {};

/** Прогоняет axe (wcag2a+wcag2aa) по текущей странице и сверяет с храповиком
 *  конкретного экрана. Сообщение об ошибке человекочитаемо — id/help/число
 *  узлов каждого нарушения, чтобы падение гейта сразу было понятно без
 *  повторного ручного прогона. */
async function checkScreen(page: Page, screenId: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const describe = (v: (typeof results.violations)[number]) =>
    `  [${v.impact ?? '?'}] ${v.id} — ${v.help} (узлов: ${v.nodes.length})\n` +
    v.nodes
      .slice(0, 3)
      .map((n) => `      ${JSON.stringify(n.target)}`)
      .join('\n');

  const critical = results.violations.filter((v) => v.impact === 'critical');
  const allowedCritical = FROZEN_CRITICAL[screenId] ?? [];
  const unexpectedCritical = critical.filter(
    (v) => !allowedCritical.includes(v.id),
  );
  expect(
    unexpectedCritical.map(describe).join('\n'),
    `критические нарушения доступности на «${screenId}» — чинить сразу, не бейслайнить:\n${unexpectedCritical.map(describe).join('\n')}`,
  ).toBe('');

  const allowed = baseline[screenId];
  expect(
    allowed,
    `нет строки для «${screenId}» в e2e-browser/a11y-baseline.json — добавь честным прогоном`,
  ).toBeDefined();

  const total = results.violations.length;
  expect(
    total,
    total > allowed
      ? `a11y-храповик «${screenId}»: нарушений стало ${total}, было ${allowed}. Новые/выросшие:\n` +
          results.violations.map(describe).join('\n')
      : undefined,
  ).toBeLessThanOrEqual(allowed);
}

/** Тесты webapp реально выполняются только в проекте webapp (baseURL 4173);
 *  на любом другом проекте экран пропускается. */
function skipOnOtherProject(testInfo: TestInfo, expected: string): void {
  test.skip(
    testInfo.project.name !== expected,
    `экран принадлежит проекту «${expected}», не «${testInfo.project.name}»`,
  );
}

// Снимок axe обязан быть ДЕТЕРМИНИРОВАННЫМ. Без этого ожидания тест ловил
// случайное состояние загрузки: изолированно давал 0 нарушений, а в общем
// прогоне — то 1, то 2 (спиннеры и полурендеренные блоки: серое на сером
// читается как низкий контраст). Флак хуже отсутствия теста: правило
// проекта — ретраев нет, «иногда зелёный» за зелёный не считается.
// Ждём: непустой #root → исчезновение всех спиннеров (Loader) → затишье
// сети (данные догрузились и перерисовка завершена).
async function settled(page: import('@playwright/test').Page) {
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('.spinner')).toHaveCount(0, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

test.describe('a11y-smoke: webapp', () => {
  test('главная (/)', async ({ page }, testInfo) => {
    skipOnOtherProject(testInfo, 'webapp');
    await page.goto('/');
    await settled(page);
    await checkScreen(page, 'webapp:home');
  });

  test('список статей (/articles)', async ({ page }, testInfo) => {
    skipOnOtherProject(testInfo, 'webapp');
    await page.goto('/articles');
    await settled(page);
    await checkScreen(page, 'webapp:articles');
  });
});

/** Тёмная тема, сохранённая пользователем на лендинге: App.tsx читает ключ
 *  до первого рендера и ставит `data-theme="dark"` на <html>. Скрипт идёт до
 *  кода страницы, как и согласие на куки в stubApi. */
async function rememberDarkTheme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('app_theme', 'dark');
    } catch {
      // about:blank до первой навигации: у документа нет хранилища.
    }
  });
}

/** Задание от терапевта в форме `UserTask` (shared/src/apiTypes.ts), как
 *  отдаёт TherapyTasksService.getUserTasks. Без него кабинет чистого клиента
 *  не содержит ни одного текста без явного `color`: заголовок блока «От
 *  терапевта» (`.ds-h2`) и текст задания — те самые элементы инцидента,
 *  которые наследуют цвет от body (с #941 — на «Практиках», не на «Сегодня»).
 *  Проверено на дереве без фиксов #929: на пустом стабе все состояния были
 *  зелёными. */
const THERAPIST_TASK = {
  id: 1,
  userId: '1',
  assignedBy: '2',
  type: 'custom',
  text: 'Записать три ситуации, которые задели за день',
  targetDays: null,
  needId: null,
  dueDate: null,
  done: null,
  completedAt: null,
  createdAt: '2026-11-05T08:00:00.000Z',
};

/** Открывает раздел кабинета вошедшим клиентом с одним заданием терапевта
 *  и дожидается отрисовки. Фикстура стаба для чистого клиента — `[]` (её
 *  сверяет с живым сервером test/browser-stub-contract.e2e-spec.ts), задание
 *  кладётся поверх через `api.overrides`. На чистом аккаунте «Сегодня» сам
 *  открывает лист «Зачем это всё» поверх плиток — закрываем: инцидент был
 *  про текст кабинета под ним, а оверлей на весь экран прячет его от axe. */
async function openCabinet(
  page: Page,
  api: StubApiHandle,
  path: string,
): Promise<void> {
  api.overrides.set('GET /api/therapy/tasks', [THERAPIST_TASK]);
  await page.goto(path);
  await settled(page);
  const whyDone = page.getByRole('button', { name: 'Понятно, начнём' });
  if ((await whyDone.count()) > 0) {
    await whyDone.click();
    await expect(whyDone).toHaveCount(0);
  }
  if (path === '/practice')
    await expect(
      page.getByRole('heading', { name: 'От терапевта' }),
    ).toBeVisible();
}

// «Практики» — экран, где после #941 живут задания терапевта: заголовок
// «От терапевта» и строка задания наследуют цвет от body; «Сегодня» и
// «Записи» — экраны инцидента, держат храповик каждый для себя.
const CABINET_SCREENS: { path: string; id: string }[] = [
  { path: '/today', id: 'webapp:today' },
  { path: '/diary', id: 'webapp:diary' },
  { path: '/practice', id: 'webapp:practice' },
];

test.describe('a11y-smoke: кабинет (инцидент 2026-11-05)', () => {
  for (const { path, id } of CABINET_SCREENS) {
    test(`${path}: светлая тема`, async ({ page, api }, testInfo) => {
      skipOnOtherProject(testInfo, 'webapp');
      await openCabinet(page, api, path);
      await checkScreen(page, id);
    });

    test(`${path}: тёмная тема в localStorage до загрузки`, async ({
      page,
      api,
    }, testInfo) => {
      skipOnOtherProject(testInfo, 'webapp');
      await rememberDarkTheme(page);
      await openCabinet(page, api, path);
      await checkScreen(page, `${id}:dark-storage`);
    });

    test(`${path}: тёмный атрибут на <html> после отрисовки`, async ({
      page,
      api,
    }, testInfo) => {
      skipOnOtherProject(testInfo, 'webapp');
      await openCabinet(page, api, path);
      // Тумблер лендинга (applyTheme) в SPA-сессии: атрибут меняется на
      // живом документе, кабинет не перемонтируется — держит только CSS.
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
      });
      await checkScreen(page, `${id}:dark-html`);
    });
  }
});
