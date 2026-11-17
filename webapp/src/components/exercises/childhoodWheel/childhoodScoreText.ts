// Подпись к баллу детства на листе потребности (NeedDetailSheet): полюса шкалы «Колеса
// детства», а не диапазоны трекера — те описывают сегодняшний день, а не детство.
import { NEEDS } from './needs';

/** Низкий балл (≤3) — нижний полюс, высокий (≥7) — верхний, середина и чужой id — без подписи. */
export function childhoodScoreText(needId: string, rating: number): string | null {
  const need = NEEDS.find((n) => n.id === needId);
  if (!need) return null;
  if (rating <= 3) return need.low;
  if (rating >= 7) return need.high;
  return null;
}
