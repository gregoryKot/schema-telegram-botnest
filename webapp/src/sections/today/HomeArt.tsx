import { needColor, NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';

// Картинки главной «Сегодня» (владелец 2026-11-04: «добавил бы картинки»).
// Встроенный SVG, цвета только из токенов: внешних файлов нет (CSP 'self'),
// размытия нет (check-render-poison), на телефоне рисуется один раз.
// Декор: aria-hidden, смысл несёт текст рядом.

/** Пять потребностей как лепестки: оценённая — в своём цвете, остальные — пустой контур. */
export function NeedGarden({ ratings }: { ratings: Record<string, number> }) {
  // Лепестки веером: пять точек на дуге, центр внизу.
  const petals = NEED_COLOR_ORDER.map((id, i) => {
    const a = Math.PI * (0.15 + 0.7 * (i / (NEED_COLOR_ORDER.length - 1)));
    return { id, x: 48 + 30 * Math.cos(a), y: 60 - 30 * Math.sin(a), rated: ratings[id] !== undefined };
  });
  return (
    <svg className="ct-art ct-art--garden" viewBox="0 0 96 72" aria-hidden="true" focusable="false">
      <path d="M8 66 Q48 40 88 66" fill="none" stroke="var(--accent-line)" strokeWidth="2" strokeLinecap="round" />
      {petals.map(p => (
        <circle
          key={p.id}
          data-need={p.id}
          data-rated={p.rated ? 'yes' : 'no'}
          cx={p.x}
          cy={p.y}
          r="9"
          fill={p.rated ? needColor(p.id) : 'var(--paper-sunk)'}
          stroke={p.rated ? 'none' : 'var(--line-strong)'}
          strokeWidth="1.5"
        />
      ))}
      <circle cx="48" cy="62" r="5" fill="var(--accent)" />
    </svg>
  );
}

/** Камень в воде: круги расходятся — «момент, после которого стало не по себе». */
export function RippleArt() {
  return (
    <svg className="ct-art ct-art--spot" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--c-clay)" strokeOpacity=".25" strokeWidth="2" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="var(--c-clay)" strokeOpacity=".5" strokeWidth="2" />
      <circle cx="24" cy="24" r="6" fill="var(--c-clay)" />
    </svg>
  );
}

/** Лист с прожилкой — дневник, то, что растёт из записей. */
export function LeafArt() {
  return (
    <svg className="ct-art ct-art--spot" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M10 38 C10 16 26 8 40 8 C40 24 30 38 10 38 Z" fill="var(--c-moss)" fillOpacity=".3" />
      <path d="M10 38 C18 30 26 22 38 10" fill="none" stroke="var(--c-moss)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Чашка с паром — пустая лента дня: ничего не записано, и это нормально. */
export function RestArt() {
  return (
    <svg className="ct-art ct-art--rest" viewBox="0 0 56 48" aria-hidden="true" focusable="false">
      <path d="M10 22 H38 V32 A10 10 0 0 1 28 42 H20 A10 10 0 0 1 10 32 Z" fill="var(--paper-sunk)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <path d="M38 26 H42 A5 5 0 0 1 42 36 H38" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      <path d="M19 16 C19 12 22 12 22 8 M27 16 C27 12 30 12 30 8" fill="none" stroke="var(--c-slate)" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
