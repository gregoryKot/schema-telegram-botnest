// Подпись к баллу детства на листе потребности (NeedDetailSheet): полюса шкалы «Колеса
// детства», а не диапазоны трекера — те описывают сегодняшний день, а не детство.
import { childhoodLevel } from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import { NEEDS } from './needs';

/** Дефицит — нижний полюс, «хватало» — верхний (пороги childhoodLevel), середина и чужой id — без подписи. */
export function childhoodScoreText(needId: string, rating: number): string | null {
  const need = NEEDS.find((n) => n.id === needId);
  if (!need) return null;
  const level = childhoodLevel(rating);
  return level === 'low' ? need.low : level === 'high' ? need.high : null;
}
