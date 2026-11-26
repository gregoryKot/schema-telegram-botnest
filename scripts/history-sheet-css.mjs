// Оверлей, заданный классами из CSS, для гейта check-history-sheet.mjs. Объявления складываются:
// у класса — по всем его правилам и файлам (тот же селектор в разных правилах), у className — по
// всем его классам (fixed у одного, inset: 0 у другого). Тест — history-sheet-css.spec.ts.
import { stripComments } from './gate-strip-comments.mjs';
import { classNameValues, isOverlayDecls, lineAt } from './history-sheet-detect.mjs';

/**
 * Объявления по классам из всех CSS-текстов: класс — последний в последнем
 * компоненте селектора (`.a .b.c` → c); псевдоэлементы (`::before` — декор) не в счёт.
 */
export function classDeclarations(cssTexts) {
  const decls = new Map();
  for (const raw of cssTexts) {
    for (const m of stripComments(raw, true).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const sel of m[1].split(',')) {
        if (/::|:before|:after/.test(sel)) continue;
        const last = sel.trim().split(/[\s>+~]+/).pop() ?? '';
        const cls = [...last.matchAll(/\.([A-Za-z_][\w-]*)/g)].pop()?.[1];
        if (cls) decls.set(cls, `${decls.get(cls) ?? ''}${m[2]};`);
      }
    }
  }
  return decls;
}

/** Классы, которые по сумме своих правил делают элемент оверлеем (fixed + весь экран). */
export function overlayClassSet(decls) {
  return new Set([...decls].filter(([, d]) => isOverlayDecls(d)).map(([cls]) => cls));
}

// Класс несёт часть оверлея: `position: fixed` или нулевую сторону.
const PART_RE = /\bposition\s*:\s*['"]?fixed\b|\b(?:inset|top|left|right|bottom)\s*:\s*['"]?0/;

/**
 * Оверлеи из className в .tsx: класс-оверлей сам по себе либо классы одного
 * className, которые вместе дают fixed и весь экран. decls — classDeclarations.
 */
export function classOverlays(rawSrc, decls) {
  const src = stripComments(rawSrc, false);
  const found = [];
  for (const { at, text } of classNameValues(src)) {
    const classes = [...new Set(text.match(/[A-Za-z_][\w-]*/g) ?? [])].filter((t) => decls.has(t));
    const own = classes.filter((cls) => isOverlayDecls(decls.get(cls)));
    const parts = classes.filter((cls) => PART_RE.test(decls.get(cls)));
    const line = lineAt(src, at);
    for (const cls of own) found.push({ line, what: `класс «${cls}» (CSS: fixed + весь экран)` });
    if (!own.length && parts.length > 1 && isOverlayDecls(parts.map((cls) => decls.get(cls)).join(''))) {
      found.push({ line, what: `классы «${parts.join('» + «')}» (CSS: fixed + весь экран вместе)` });
    }
  }
  return found;
}
