// Размеры тап-целей, заданные CSS-классами (docs/open/frontend-ux.md: гейт
// check-tap-targets видел только инлайновый style, а `.evi-x` 22×22 и малый
// тумблер `.ds-switch--sm` заданы классом). Из .css берутся правила с
// селектором ровно `.класс` (размер блока: width/min-width, height/min-height
// в px) и `.класс::before|::after` с отрицательным inset (невидимая зона
// нажатия — приём `.evi-x`, `.ds-switch`).
//
// Элемент с несколькими классами берёт каждое свойство из правила, стоящего в
// CSS последним: специфичность у `.a` и `.b` одна, побеждает порядок. Условный
// класс (`${small ? ' x--sm' : ''}`) считается применённым: вариант где-то
// рисуется, и его зона та же. Контекст @media не различается — гейт не угадывает
// устройство. Вызывает tap-targets-rules.mjs; тест — tap-targets-css.spec.ts.
import { parseCssRules, splitSelectorList } from './css-rules-parse.mjs';
import { stripComments } from './gate-strip-comments.mjs';

const px = (v) => {
  const m = /^(-?\d+(?:\.\d+)?)px$|^0$/.exec((v ?? '').trim());
  return m ? Number(m[1] ?? 0) : null;
};
const maxPx = (...vs) => {
  const n = vs.map(px).filter((v) => v !== null);
  return n.length ? Math.max(...n) : null;
};

/** Отрицательный inset → прирост зоны по осям { x, y }; null — значение не в px. */
export function insetGrowth(inset) {
  if (!inset) return null;
  const p = inset.trim().split(/\s+/).map(px);
  if (p.some((v) => v === null) || p.length > 4) return null;
  const [t, r = t, b = t, l = r] = p;
  const out = (v) => Math.max(0, -v);
  return { x: out(l) + out(r), y: out(t) + out(b) };
}

/** Свойства классов из CSS: Map класс → { w, h, gx, gy } (каждое { v, o }, o — порядок). */
export function cssTargetProps(cssTexts) {
  const props = new Map();
  cssTexts.forEach((text, fi) => {
    for (const r of parseCssRules(stripComments(text, true))) {
      const o = fi * 1e6 + r.line;
      for (const sel of splitSelectorList(r.selector)) {
        const m = /^\.([\w-]+)(::?(?:before|after))?$/.exec(sel.trim());
        if (!m) continue;
        const p = props.get(m[1]) ?? {};
        const set = (k, v) => {
          if (v !== null && (!p[k] || p[k].o <= o)) p[k] = { v, o };
        };
        if (m[2]) {
          const g = insetGrowth(r.decls.inset);
          if (g) {
            set('gx', g.x);
            set('gy', g.y);
          }
        } else {
          set('w', maxPx(r.decls.width, r.decls['min-width']));
          set('h', maxPx(r.decls.height, r.decls['min-height']));
        }
        props.set(m[1], p);
      }
    }
  });
  return props;
}

/**
 * Классы из значения className (строка или выражение): только тексты строковых
 * литералов; в шаблоне подстановки `${…}` отбрасываются (строки внутри них уже
 * взяты первым проходом), имена переменных за классы не считаются.
 */
export function classTokens(value) {
  const parts = [];
  for (const m of value.matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)) parts.push(m[1] ?? m[2]);
  for (const m of value.matchAll(/`([^`]*)`/g)) parts.push(m[1].replace(/\$\{[^}]*\}/g, ' '));
  return parts.join(' ').match(/[\w-]+/g) ?? [];
}

/** Зона нажатия по классам элемента; null — размер классами не задан по обеим осям. */
export function classTargetSize(tokens, props) {
  const pick = (k) =>
    tokens
      .map((t) => props.get(t)?.[k])
      .filter(Boolean)
      .sort((a, b) => b.o - a.o)[0]?.v;
  const w = pick('w');
  const h = pick('h');
  if (w === undefined || h === undefined) return null;
  return { w: w + (pick('gx') ?? 0), h: h + (pick('gy') ?? 0) };
}
