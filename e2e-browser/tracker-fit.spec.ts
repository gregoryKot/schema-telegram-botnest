// Вопрос трекера на телефоне (ревью g2, docs/design/APP_2026-11.md, раздел b07, принцип 5).
//
// 1) Все пять ответов — на первом экране 390×844. Лист потребности над вопросом
//    вырос до 241px, и «Полностью» уходил под сгиб (низ ≈ 892). Круг 4: меряем
//    каждый из пяти вопросов, а не только первый — у «Автономии», «Границ» и
//    «Выражения чувств» запас был 3–8px, и строчка в описании молча вернула бы
//    пятый ответ под сгиб. Отдельно — первый показ, со строкой «откуда это».
// 2) Верхняя полоса помещается в узкий телефон: на 360 «Пропустить» вылезал за
//    край окна (круг 1 поднял поле полосы до 12px), на 320 полоска текущей точки
//    наезжала на «Закрыть» (круг 4). Круг 5: полоска идёт по всем пяти вопросам —
//    у пятого она у «Пропустить» (зазор 7px), поэтому меряем каждый вопрос и обе
//    стороны; на 320 подписи не ближе 8px к краю окна (скругление WebView). Круг 6:
//    и на 360 (там «Пропустить» кончался в 5px от края и выходил из кнопки).
// Высоту и ширину считает только браузер (jsdom CSS не исполняет), поэтому
// замер — здесь, на прод-сборке. Раскладка — webapp/src/styles/tracker-question.css.
import { test, expect, type Page } from './support/test';

const PHONE = { width: 390, height: 844, fold: 830 };

async function openTracker(page: Page, { seen = true } = {}) {
  if (seen) {
    await page.addInitScript(() => {
      localStorage.setItem('tracker_onboarding_v1', '1');
    });
  }
  await page.goto('/today');
  // На чистом аккаунте сам открывается лист «Зачем это всё» — закрываем его.
  await page.getByRole('button', { name: 'Понятно, начнём' }).click();
  await page.getByRole('button', { name: /^Трекер/ }).click();
  await page.evaluate(() => document.fonts.ready);
}

/** Низ пятого ответа текущего вопроса и высота листа потребности над ним. */
async function fifthAnswerBottom(page: Page) {
  const answers = page
    .locator('.tk2-overlay .tq-ask')
    .getByRole('button', { name: / из 10$/ });
  await expect(answers).toHaveCount(5);
  const sheet = await page.locator('.tq-sheet').boundingBox();
  const last = await answers.nth(4).boundingBox();
  expect(last, 'пятый ответ не найден').not.toBeNull();
  return {
    bottom: last!.y + last!.height,
    sheet: Math.round(sheet?.height ?? 0),
  };
}

test(`вопрос трекера ${PHONE.width}×${PHONE.height}: у каждого из пяти вопросов пятый ответ выше ${PHONE.fold}`, async ({
  page,
}) => {
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height });
  await openTracker(page);
  const dots = page.locator('.tk2-overlay .tq-dot-hit');
  await expect(dots).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await expect(dots.nth(i)).toHaveAttribute('aria-current', 'step');
    const need = await dots.nth(i).getAttribute('aria-label');
    const { bottom, sheet } = await fifthAnswerBottom(page);
    expect(
      bottom,
      `«${need}»: низ пятого ответа под сгибом (лист потребности ${sheet}px)`,
    ).toBeLessThanOrEqual(PHONE.fold);
    if (i < 4) await page.getByRole('button', { name: 'Пропустить' }).click();
  }
});

// Первый показ — осознанное исключение из запаса 830 (раздел b07, «Не сделано»): строка «откуда это»
// в три строки над листом; ужата до ~841 (было 855, в main 928), дальше — только короче сам текст.
// Держим «все пять ответов в окне».
test(`первый показ ${PHONE.width}×${PHONE.height}: со строкой «откуда это» пятый ответ в окне`, async ({
  page,
}) => {
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height });
  await openTracker(page, { seen: false });
  await expect(page.locator('.tq-note')).toBeVisible();
  const { bottom, sheet } = await fifthAnswerBottom(page);
  expect(
    bottom,
    `низ пятого ответа за окном (лист потребности ${sheet}px, над ним «откуда это»)`,
  ).toBeLessThanOrEqual(PHONE.height);
});

/** Прямоугольники полосы: «Закрыть» и «Пропустить» (кнопка и сам текст), полоска текущей точки. */
async function barRects(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector('.tk2-overlay .tq-bar') as HTMLElement;
    const box = (r: DOMRect) => ({ left: r.left, right: r.right });
    const text = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return box(range.getBoundingClientRect());
    };
    const close = bar.querySelector(':scope > .tq-bar-btn')!;
    const skip = bar.querySelector('.tq-skip')!;
    return {
      innerWidth,
      scrollWidth: bar.scrollWidth,
      clientWidth: bar.clientWidth,
      closeText: text(close),
      skipBtn: box(skip.getBoundingClientRect()),
      skipText: text(skip),
      pill: box(
        bar.querySelector('.tq-dot.is-current')!.getBoundingClientRect(),
      ),
    };
  });
}

for (const vp of [
  { width: 360, height: 640, edge: 8 },
  { width: 320, height: 568, edge: 8 },
]) {
  test(`шапка вопроса ${vp.width}×${vp.height}: «Закрыть», точки и «Пропустить» в окне, не наезжают ни на одном из пяти вопросов`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openTracker(page);
    const dots = page.locator('.tk2-overlay .tq-dot-hit');
    await expect(dots).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(dots.nth(i)).toHaveAttribute('aria-current', 'step');
      await expect(
        page.locator('.tk2-overlay .tq-dot.is-current'),
      ).toBeVisible();
      const m = await barRects(page);
      const q = `вопрос ${i + 1}`;
      expect(m.scrollWidth, `${q}: полоса шире окна`).toBeLessThanOrEqual(
        m.clientWidth,
      );
      expect(
        m.closeText.left,
        `${q}: «Закрыть» у самого края окна`,
      ).toBeGreaterThanOrEqual(vp.edge);
      expect(
        m.skipText.right,
        `${q}: «Пропустить» за краем окна или у самого края`,
      ).toBeLessThanOrEqual(m.innerWidth - vp.edge);
      expect(
        m.skipText.right,
        `${q}: «Пропустить» вылезает из своей кнопки`,
      ).toBeLessThanOrEqual(m.skipBtn.right + 0.5);
      expect(
        m.pill.left,
        `${q}: полоска текущей точки наезжает на «Закрыть»`,
      ).toBeGreaterThanOrEqual(m.closeText.right);
      expect(
        m.pill.right,
        `${q}: полоска текущей точки наезжает на «Пропустить»`,
      ).toBeLessThanOrEqual(m.skipText.left);
      if (i < 4) await page.getByRole('button', { name: 'Пропустить' }).click();
    }
  });
}
