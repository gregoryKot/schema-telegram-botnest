// Ползунок 0–10 «Колеса детства» (вёрстка — CWTrack): указатель и клавиатура,
// роль slider и aria-value*. Разбор жеста тап/протяжка/прокрутка — sliderGesture.
// До QA 2026-11 (З13) на сайте шкала была div с одними pointer-событиями.
import { useRef, type KeyboardEvent } from 'react';
import { useSliderPointer } from './sliderGesture';

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
  const pointer = useSliderPointer(fromPointer);
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
    ...pointer,
  };
}
