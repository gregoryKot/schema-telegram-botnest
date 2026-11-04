import { NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';

// Картинки главной «Сегодня» — бумажная аппликация по референсу владельца
// (2026-11-04): пять полосок потребностей, завиток ленты, три камешка, чашка.
// Встроенный SVG, цвета только из токенов: внешних файлов нет (CSP 'self'),
// размытия нет (check-render-poison), на телефоне рисуется один раз.
// Декор: aria-hidden, смысл несёт текст рядом.

/** Пять полосок цветной бумаги — по одной на потребность. Оценённая сегодня —
 *  плотная, остальные бледнее: картинка живая у новичка и честная у того, кто заполнил. */
export function NeedStrokes({ ratings }: { ratings: Record<string, number> }) {
  const tilt = [-6, 3, -2, 5, -4];
  // Бумага референса: тёмная зелень, шалфей, тёмно-коричневый, терракота, шалфей —
  // палитра картинки, не цвета потребностей (те — в трекере, needColors).
  const sage = 'color-mix(in srgb, var(--c-moss) 55%, var(--bg))';
  const paper = ['var(--c-moss)', sage, 'var(--text-sub)', 'var(--c-clay)', sage];
  return (
    <svg className="ct-art ct-art--strokes" viewBox="0 0 120 100" aria-hidden="true" focusable="false">
      {NEED_COLOR_ORDER.map((id, i) => {
        const rated = ratings[id] !== undefined;
        return (
          <rect
            key={id}
            data-need={id}
            data-rated={rated ? 'yes' : 'no'}
            x={8 + i * 22}
            y={rated ? 8 : 16}
            width="16"
            height={rated ? 84 : 72}
            rx="8"
            fill={paper[i]}
            fillOpacity={rated ? 1 : 0.5}
            transform={`rotate(${tilt[i]} ${16 + i * 22} 50)`}
          />
        );
      })}
    </svg>
  );
}

/** Завиток ленты — «Что случилось»: момент, который зацепил и закрутился. */
export function RibbonArt() {
  return (
    <svg className="ct-art ct-art--square" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
      <path
        d="M8 46 C 18 18, 54 10, 66 30 C 76 48, 44 60, 36 42 C 28 24, 66 6, 112 26"
        fill="none" stroke="var(--c-clay)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Три камешка цветной бумаги — дневник: мысль, схема, спасибо. */
export function PebblesArt() {
  return (
    <svg className="ct-art ct-art--square" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
      <ellipse cx="24" cy="36" rx="20" ry="13" transform="rotate(-18 24 36)" fill="var(--c-moss)" />
      <ellipse cx="60" cy="34" rx="20" ry="13" transform="rotate(-18 60 34)" fill="var(--text-sub)" />
      <ellipse cx="96" cy="30" rx="20" ry="13" transform="rotate(-18 96 30)" fill="var(--c-clay)" />
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
