// Колесо детства сценой (SceneChildhood values, LandingScenes.tsx) вместо радара: полоска на
// потребность в порядке NEEDS, длина — оценка/10, ниже 5 — бледная и без тени. Цвет полоски —
// цвет данных потребности (needDataColor, docs/design/APP_2026-11.md, «Палитра данных»): та же
// потребность тем же цветом, что ползунок строки, «История» и трекер. Без оценки — полоски нет:
// на шаге оценки колесо растёт по мере ответов, а не стартует с выдуманных нулей или пятёрок.
import type { NeedId } from '../../../../../shared/src/needs/types';
import { needDataColor } from '../../needDataColor';
import { NEEDS } from './needs';

/** Цвета полосок по порядку NEEDS (запасной — текстовый токен, если потребности нет в палитре). */
export const WHEEL_FILLS: readonly string[] = NEEDS.map((n) => needDataColor(n.id) ?? 'var(--text-sub)');

/** Оценки в порядке NEEDS; неоценённая (в `unrated` или без числа) — null. */
export function wheelValues(
  ratings: Partial<Record<NeedId, number>>,
  unrated: readonly NeedId[] = [],
): (number | null)[] {
  return NEEDS.map((n) => {
    const v = ratings[n.id];
    return unrated.includes(n.id) || typeof v !== 'number' ? null : v;
  });
}
