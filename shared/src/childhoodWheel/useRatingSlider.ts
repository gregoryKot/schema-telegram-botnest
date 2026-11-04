// Ползунок 0–10 «Колеса детства» — один механизм ввода для обеих площадок:
// указатель (тап и протяжка) и клавиатура, роль slider и aria-value*. Вёрстка
// трека у каждой своя (мини-апп — Slider, сайт — CWTrack), поведение — отсюда.
// До QA 2026-11 (З13) клавиатура жила только в мини-аппе: на сайте шкала была
// div с одними pointer-событиями, без мыши колесо не проходилось.
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

export const RATING_MIN = 0;
export const RATING_MAX = 10;
/** Откуда стартуют стрелки и Enter, пока потребность не оценена. */
const START = 5;

const clamp = (n: number) => Math.max(RATING_MIN, Math.min(RATING_MAX, n));

/** Значение после клавиши; null — клавиша не ползунка (Tab и прочие).
 * Enter и пробел ставят неоценённой потребности середину — с неё удобно
 * двигаться стрелками; у оценённой оставляют как есть. */
export function ratingKeyValue(
  key: string,
  value: number | undefined,
): number | null {
  const base = value ?? START;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clamp(base + 1);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clamp(base - 1);
    case 'PageUp':
      return clamp(base + 2);
    case 'PageDown':
      return clamp(base - 2);
    case 'Home':
      return RATING_MIN;
    case 'End':
      return RATING_MAX;
    case 'Enter':
    case ' ':
      return base;
    default:
      return null;
  }
}

/** Пропсы для элемента-трека: `<div {...useRatingSlider(…)}>`. */
export function useRatingSlider({
  value,
  onChange,
  label,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  /** Доступное имя — что оцениваем (название потребности). */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fromPointer = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(clamp(Math.round(((clientX - r.left) / r.width) * RATING_MAX)));
  };
  return {
    ref,
    role: 'slider' as const,
    tabIndex: 0,
    'aria-label': label,
    'aria-valuemin': RATING_MIN,
    'aria-valuemax': RATING_MAX,
    'aria-valuenow': value,
    'aria-valuetext':
      value === undefined ? 'не оценено' : `${value} из ${RATING_MAX}`,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const next = ratingKeyValue(e.key, value);
      if (next === null) return;
      e.preventDefault();
      onChange(next);
    },
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      fromPointer(e.clientX);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (e.buttons === 0) return;
      fromPointer(e.clientX);
    },
  };
}
