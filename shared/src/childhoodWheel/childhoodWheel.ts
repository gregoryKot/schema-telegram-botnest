import { NEED_ORDER, type NeedId } from '../needs/types';
import {
  ALL_SCHEMAS,
  type FlatSchema,
} from '../schemaTherapy/schemaTherapyData';
import { needDomain } from '../schemaTherapy/schemaNeed';

// Логика «Колеса детства», общая для сайта и мини-аппа: порог низкой зоны,
// сборка сохранённых оценок, схемы, которые могут стоять за дефицитом.

export type ChildhoodRatings = Record<NeedId, number>;

/** Оценка ≤ этого значения считается дефицитом потребности в детстве. */
export const LOW_NEED_MAX = 4;

/** Оценка ≥ этого значения: потребности в детстве хватало. */
export const ENOUGH_NEED_MIN = 7;

export type ChildhoodLevel = 'low' | 'mid' | 'high';

/** Зона оценки: дефицит, середина или «хватало». Один порог на все экраны колеса и лист потребности. */
export function childhoodLevel(score: number): ChildhoodLevel {
  if (score <= LOW_NEED_MAX) return 'low';
  if (score >= ENOUGH_NEED_MIN) return 'high';
  return 'mid';
}

/** Стартовое положение ползунков (нейтральная середина, не «сохранённое»). */
export function defaultChildhoodRatings(): ChildhoodRatings {
  return { attachment: 5, autonomy: 5, expression: 5, play: 5, limits: 5 };
}

/**
 * Сохранённые оценки с сервера → значения для экрана. `hasSaved` истинно,
 * только если хотя бы одна потребность пришла валидным числом 0–10: пустой
 * ответ `{}` значит «ещё не проходили», а не «пятёрки по всем».
 */
export function readSavedRatings(
  saved: Record<string, number> | null | undefined,
): {
  ratings: ChildhoodRatings;
  hasSaved: boolean;
} {
  const ratings = defaultChildhoodRatings();
  let hasSaved = false;
  for (const id of NEED_ORDER) {
    const v = saved?.[id];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10) {
      ratings[id] = Math.round(v);
      hasSaved = true;
    }
  }
  return { ratings, hasSaved };
}

export function lowNeedIds(ratings: Record<string, number>): NeedId[] {
  return NEED_ORDER.filter((id) => ratings[id] <= LOW_NEED_MAX);
}

export function childhoodAverage(ratings: Record<string, number>): number {
  const sum = NEED_ORDER.reduce((acc, id) => acc + ratings[id], 0);
  return Math.round((sum / NEED_ORDER.length) * 10) / 10;
}

/** Домен и схемы (по id из SCHEMA_DOMAINS), которые могут сложиться при дефиците потребности: домен этой потребности. */
export const CHILDHOOD_SCHEMA_HINTS = Object.fromEntries(
  NEED_ORDER.map((id) => {
    const d = needDomain(id);
    return [
      id,
      { domain: d?.domain ?? '', schemaIds: d?.schemas.map((s) => s.id) ?? [] },
    ];
  }),
) as Record<NeedId, { domain: string; schemaIds: string[] }>;

export function hintSchemas(id: NeedId): FlatSchema[] {
  return CHILDHOOD_SCHEMA_HINTS[id].schemaIds
    .map((sid) => ALL_SCHEMAS.find((s) => s.id === sid))
    .filter((s): s is FlatSchema => !!s);
}
