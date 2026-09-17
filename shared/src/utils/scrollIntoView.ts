// Дизайн-аудит 2026-08 (Ж6): явный `behavior: 'smooth'` в JS-вызовах
// `scrollIntoView` сильнее CSS-глушилки reduced-motion (index.css каждого
// фронтенда). 8 файлов webapp + 2 miniapp звали `scrollIntoView({behavior:
// 'smooth', ...})` напрямую — переключатель `prefers-reduced-motion` /
// ручной `html[data-reduce-motion="1"]` на них не действовал.
//
// Единая точка вместо копипасты (правило «одна механика — один компонент»):
// `isReducedMotion()` уже читает оба источника (shared/src/utils/
// reducedMotion.ts) — этот хелпер просто подставляет её результат в
// `behavior`, остальные опции (`block`, `inline`) передаются как есть.
import { isReducedMotion } from './reducedMotion';

export function scrollIntoViewSafe(
  el: Element | null | undefined,
  options: Omit<ScrollIntoViewOptions, 'behavior'> = {},
): void {
  if (!el) return;
  el.scrollIntoView({
    ...options,
    behavior: isReducedMotion() ? 'auto' : 'smooth',
  });
}
