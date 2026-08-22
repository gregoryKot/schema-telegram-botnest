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
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { stubApi } from './support/stubApi';
import { openMiniApp, stubMiniApi } from './support/stubMiniApp';

const BASELINE_PATH = join(__dirname, 'a11y-baseline.json');
const baseline: Record<string, number> = JSON.parse(
  readFileSync(BASELINE_PATH, 'utf8'),
);
// «miniapp:today»: 0. По дороге волна нашла serious color-contrast на кнопке
// «Начать →» карточки HeroCta: белая подложка в обеих темах + var(--accent),
// который тёмная тема осветляет до #c97d5a — 3.19:1. Баг не от терракоты:
// прежний индиго на белом давал 3.07:1, тоже провал. Починен токеном
// --accent-on-light (тёмный вариант, не переключается по теме) — 5.33:1,
// поэтому счётчик остаётся нулевым, а не поднимается «как унаследованный».

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

/** Экраны webapp и мини-аппа делят один файл (общая логика храповика), но у
 *  них разный baseURL — один спек не может обслуживать оба одновременно
 *  внутри одного проекта Playwright. Каждый набор тестов пропускается на
 *  «чужом» проекте, поэтому дубликатов прогона нет: webapp-тесты реально
 *  выполняются только в проекте webapp (baseURL 4173), миниапп — только в
 *  miniapp (baseURL 4174, мобильный профиль). */
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
  test.beforeEach(async ({ page }, testInfo) => {
    skipOnOtherProject(testInfo, 'webapp');
    await stubApi(page);
  });

  test('главная (/)', async ({ page }) => {
    await page.goto('/');
    await settled(page);
    await checkScreen(page, 'webapp:home');
  });

  test('список статей (/articles)', async ({ page }) => {
    await page.goto('/articles');
    await settled(page);
    await checkScreen(page, 'webapp:articles');
  });
});

test.describe('a11y-smoke: мини-апп', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipOnOtherProject(testInfo, 'miniapp');
    await stubMiniApi(page);
  });

  test('главный экран «Сегодня»', async ({ page }) => {
    await openMiniApp(page);
    await page.getByRole('button', { name: 'Сегодня', exact: true }).waitFor();
    // networkidle — тот же принцип, что settled() выше для webapp (мини-апп
    // раньше его не ждал): HeroCta и текст описания шага долистывают
    // содержимое после первого рендера, и без этого ожидания снимок ловил
    // промежуточный кадр с заниженным контрастом (дизайн-аудит 2026-08 В11 —
    // нашлось при переводе акцента на терракоту, у нового оттенка запас
    // контраста меньше, чем был у прежнего индиго, и «плавающий» кадр стал
    // заметен гейту).
    await page.waitForLoadState('networkidle');
    await checkScreen(page, 'miniapp:today');
  });
});
