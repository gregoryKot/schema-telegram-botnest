// Ритм страницы один на все разделы: расстояние между блоками даёт gap у
// .ds-page (cabinet.css), и пустой блок-обёртка на странице его удваивает.
// Так на «Записях» между «Записать» и фильтрами стояло 48px вместо 24 —
// всегда рисовалась пустая обёртка черновиков (скрин владельца 2026-11-06).
// jsdom высоту не считает, поэтому замер — здесь: на каждом разделе из смока
// у видимого ребёнка .ds-page высота больше нуля. Чистый аккаунт — тот самый
// случай, когда условных блоков нет и пустые обёртки видны.
import { test, expect } from './support/test';

const SECTIONS = ['/today', '/diary', '/more', '/practice'];
const SIZES = [
  { name: 'телефон', width: 393, height: 852 },
  { name: 'компьютер', width: 1280, height: 800 },
];

for (const size of SIZES) {
  for (const path of SECTIONS) {
    test(`${size.name}, ${path}: на странице нет пустых блоков`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(path);
      await page.locator('.ds-page').first().waitFor();
      await expect(page.locator('.ds-page .skel')).toHaveCount(0);

      // Листы (position: fixed) — поверх страницы, в её ритм не входят.
      const empty = await page.evaluate(() =>
        [...document.querySelectorAll('.ds-page')].flatMap((p) =>
          [...p.children]
            .filter((c) => {
              const s = getComputedStyle(c);
              return s.display !== 'none' && s.position !== 'fixed';
            })
            .filter((c) => c.getBoundingClientRect().height === 0)
            .map((c) => `${c.tagName.toLowerCase()}.${c.className}`),
        ),
      );
      expect(empty, 'пустой блок на странице даёт двойной отступ').toEqual([]);
    });
  }
}
