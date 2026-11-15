// Кнопки дизайн-системы в CSS для check-tap-targets.mjs. `.ds-seg-btn` и `.ds-link`
// в разметке идут классом без размера, высота у них из padding — гейт по TSX её не
// видит. Поэтому сверяется сам CSS: цель — класс `ds-*` с `cursor: pointer` в правиле
// `.класс` и его модификатор `ds-*--x` со своей высотой. Высота (height/min-height
// где угодно в CSS, @media не различается — 44 под пальцем даёт блок pointer: coarse)
// плюс зона `::before` с отрицательным inset обязана дотянуть до 44. Свойства классов —
// cssTargetProps (tap-targets-css.mjs); тест — tap-targets-css.spec.ts.

// Ссылка внутри бегущего текста остаётся в строке абзаца без зоны 44 (cabinet.css, #906);
// карточка и строка списка нажимаются целиком — блок с отступами 14–22px, выше 44 содержимым.
export const DS_TARGET_EXEMPT = new Set([
  'ds-link--inline',
  'ds-card--hover',
  'ds-list-row--hover',
]);

/** Нарушения: [{ cls, h (null — высота не задана), f — индекс CSS-файла }]. */
export function dsTargetViolations(props, min) {
  const out = [];
  for (const [cls, p] of props) {
    if (!cls.startsWith('ds-') || DS_TARGET_EXEMPT.has(cls)) continue;
    const base = props.get(cls.replace(/--[\w-]+$/, ''));
    const isMod = base !== undefined && base !== p && base.ptr && p.h;
    if (!p.ptr && !isMod) continue;
    const gy = p.gy?.v ?? (p.ptr ? 0 : (base.gy?.v ?? 0));
    const h = p.h ? p.h.v + gy : null;
    if (h === null || h < min) out.push({ cls, h, f: p.f ?? 0 });
  }
  return out;
}

/** Счёт нарушений в храповик — на CSS-файл с первым правилом класса. */
export function countDsTargets(props, cssFiles, counts, details, min) {
  for (const v of dsTargetViolations(props, min)) {
    const file = cssFiles[v.f];
    counts[file] = (counts[file] ?? 0) + 1;
    (details[file] ??= []).push(
      `  .${v.cls}: высота ${v.h ?? 'не задана'} — кнопке дизайн-системы нужна min-height 44 (хотя бы под пальцем) или зона ::before`,
    );
  }
}
