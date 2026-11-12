// Итог «Колеса детства» на узком телефоне (ревью g6, docs/design/APP_2026-11.md, раздел b19).
//
// В листе «Возможные активные схемы» имя потребности и оценка стояли одной строкой
// сетки `44px 1fr auto`: на 320 «Привязанность» (16px/600) не помещалась в свою
// колонку и наезжала на «4/10 в детстве» — «Привязанность4/10 в детстве». Теперь имя
// и оценка — строка с переносом (sheet-childhood.css, .chw-hint-title): не влезли —
// оценка уходит под имя. Пересечение прямоугольников считает только браузер
// (jsdom CSS не исполняет), поэтому замер — здесь, на прод-сборке.
import { test, expect } from './support/test';

// Те же оценки, что у «богатого» клиента стенда: подсказки есть у трёх потребностей ниже 6.
const RATINGS = {
  attachment: 4,
  autonomy: 5,
  expression: 2,
  play: 6,
  limits: 7,
};

for (const width of [320, 360, 390]) {
  test(`итог колеса ${width}px: имя потребности и оценка в подсказке не пересекаются`, async ({
    page,
    api,
  }) => {
    api.overrides.set('GET /api/childhood-ratings', RATINGS);
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/practice');
    await page.locator('.cp-ex', { hasText: 'Колесо детства' }).first().click();
    const heads = page.locator('.chw-hint-head');
    await expect(heads.first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const boxes = await heads.evaluateAll((els) =>
      els.map((el) => {
        // Прямоугольник самого текста (Range), а не ячейки: в старой сетке ячейка имени была узкой, а слово
        // вылезало из неё поверх оценки — у ячеек пересечения не было, у текста было.
        const r = (sel: string) => {
          const range = document.createRange();
          range.selectNodeContents(el.querySelector(sel)!);
          return range.getBoundingClientRect();
        };
        const name = r('.chw-hint-name');
        const score = r('.chw-hint-score');
        const head = el.getBoundingClientRect();
        return {
          name: el.querySelector('.chw-hint-name')!.textContent,
          overlap:
            name.left < score.right &&
            score.left < name.right &&
            name.top < score.bottom &&
            score.top < name.bottom,
          out: score.right > head.right + 0.5 || name.right > head.right + 0.5,
        };
      }),
    );
    expect(boxes.length, 'подсказок нет — не те оценки').toBeGreaterThan(0);
    for (const b of boxes) {
      expect(b.overlap, `«${b.name}»: имя наезжает на оценку`).toBe(false);
      expect(b.out, `«${b.name}»: текст вылез за шапку подсказки`).toBe(false);
    }
  });
}
