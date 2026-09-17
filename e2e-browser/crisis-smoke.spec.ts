// Браузерный smoke кризисного пути (CLAUDE.md, правила №7 и №14).
//
// Юниты покрывают detectCrisisAny (см. shared/src/utils/crisisMarkers.test.ts)
// и рендер CrisisCardView с готовыми props — но ни один тест не доказывает,
// что в РЕАЛЬНОМ собранном бандле карточка появляется, когда человек печатает
// в настоящее поле: сборка/минификация/код-сплиттинг лежат между «юнит
// зелёный» и «пользователь видит помощь в кризисе». Терапевтический продукт
// без доказанного кризисного пути — недопустим (правило №7).
//
// Путь до поля: AppShell → раздел «Практика» → каталог «Практики» →
// PracticesScreen (components/PracticesScreen.tsx). Выбран как самый
// стабильный: один явный текстовый инпут с placeholder'ом, без
// многошаговых упражнений (LetterEx/SafePlaceEx полнее, но требуют пройти
// несколько экранов ради того же самого detectCrisisAny + CrisisCard).
//
// Стаб — общий с tracker-smoke.spec.ts, см. support/stubApi.ts.
import { test, expect } from '@playwright/test';
import {
  CRISIS_HOTLINE_DISPLAY,
  CRISIS_HOTLINE_TEL,
} from '../shared/src/utils/crisisMarkers';
import { stubApi, throwOnPageError } from './support/stubApi';

// Реальная фраза из корпуса паттернов (CRISIS_PATTERNS: /хочу\s+умереть/) —
// не выдуманная строка, а то, что детекция действительно обязана ловить.
const CRISIS_TEXT = 'я так больше не могу, хочу умереть';
// Контроль: «карточка всегда висит» — тоже баг (правило №7: полнота важнее
// точности, но карточка на КАЖДЫЙ текст обесценивает сигнал). Фраза из той же
// предметной области (свободный текст о практике), но без маркеров.
const NEUTRAL_TEXT = 'вечерняя прогулка 20 минут перед сном';

async function openPracticesCatalog(page: import('@playwright/test').Page) {
  await page.goto('/practice');
  const catalogItem = page.getByRole('button', { name: /^Практики/ });
  await catalogItem.waitFor();
  await catalogItem.click();
  const input = page.getByPlaceholder('Добавить практику...');
  await input.waitFor();
  return input;
}

test.describe('браузерный smoke: кризисная детекция в реальном бандле', () => {
  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    throwOnPageError(page);
  });

  test('кризисная фраза показывает карточку с телефоном доверия ДО сохранения', async ({
    page,
  }) => {
    const input = await openPracticesCatalog(page);
    const overlay = page.getByTestId('practices-screen');

    // Проверка происходит на вводе, без нажатия «+Добавить» — правило №7:
    // детекция обязана срабатывать на клиенте до отправки/шифрования, а не
    // после условного сохранения.
    await input.fill(CRISIS_TEXT);

    const card = overlay.getByRole('status');
    await expect(card).toBeVisible();
    await expect(card).toContainText(CRISIS_HOTLINE_DISPLAY);
    await expect(card.locator(`a[href="${CRISIS_HOTLINE_TEL}"]`)).toBeVisible();
  });

  test('нейтральный текст карточку не показывает', async ({ page }) => {
    const input = await openPracticesCatalog(page);
    const overlay = page.getByTestId('practices-screen');
    await input.fill(NEUTRAL_TEXT);

    // «Карточка всегда висит» тоже был бы багом — теряется сигнальная
    // ценность. Раньше здесь проверялся role="status" на всей странице — но
    // он не уникален для страницы: PracticeSection (родительский экран
    // «Практика», из которого открыт каталог) безусловно рисует постоянную
    // карточку «Помощь рядом» (CrisisBlock, sections/practice/CrisisBlock.tsx)
    // — она не реагирует на текст и не обязана пропадать. PracticesScreen —
    // fixed-оверлей поверх, а не замена дерева: PracticeSection остаётся
    // смонтированным под ним, поэтому getByRole('status') на всей странице
    // всегда находит ≥1 элемент. Проверяем реактивную карточку именно
    // каталога — в границах его оверлея (data-testid="practices-screen").
    await expect(overlay.getByRole('status')).toHaveCount(0);
  });
});
