// Карта CSS-классов полноэкранных оверлеев для check-overlay-stack.mjs.
// Вынесено из гейта и его движка, чтобы оба остались в лимите размера (№10).
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { stripComments } from './gate-strip-comments.mjs';

const cssIn = (dir) => {
  try {
    return readdirSync(dir)
      .filter((n) => n.endsWith('.css'))
      .map((n) => join(dir, n));
  } catch {
    return []; // каталога может не быть (песочница теста)
  }
};

/** CSS сайта: утилиты shared (`.u-sheet`, `.u-sheet-grid` — z 80) первыми —
 * удвоенный селектор перебивает одиночный класс, — затем index.css и styles/. */
export function overlayCssFiles(root) {
  return [
    ...cssIn(join(root, 'shared/src/theme')),
    join(root, 'webapp/src/index.css'),
    ...cssIn(join(root, 'webapp/src/styles')),
  ].filter((f) => existsSync(f));
}

/** `.класс` → z-index для полноэкранных правил: `position: fixed`,
 * `inset: 0` (тот же признак, что у check-history-sheet.mjs — меню и баннеры
 * с `position: fixed` без inset листами не являются) и `z-index: N`.
 * Удвоение ради специфичности (`.u-sheet.u-sheet`) — тот же класс. */
export function cssOverlayMap(cssFiles) {
  const map = new Map();
  for (const file of cssFiles) {
    const css = stripComments(readFileSync(file, 'utf8'), true);
    // Внутренние блоки `селектор { тело }`; обёртка @media сама не матчится,
    // её вложенные правила — матчатся по одному.
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const body = m[2];
      if (
        !/position\s*:\s*fixed\b/.test(body) ||
        !/\binset\s*:\s*0\b/.test(body)
      )
        continue;
      const z = body.match(/z-index\s*:\s*(-?\d+)/);
      if (!z) continue;
      for (const sel of m[1].split(',')) {
        const cls = sel.trim().match(/^\.([\w-]+)(?:\.\1)*$/);
        if (cls && !map.has(cls[1])) map.set(cls[1], Number(z[1]));
      }
    }
  }
  return map;
}
