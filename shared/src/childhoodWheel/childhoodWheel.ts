import { NEED_ORDER, type NeedId } from '../needs/types';
import {
  ALL_SCHEMAS,
  type FlatSchema,
} from '../schemaTherapy/schemaTherapyData';

// Логика «Колеса детства», общая для сайта и мини-аппа: порог низкой зоны,
// сборка сохранённых оценок, схемы, которые могут стоять за дефицитом.

export type ChildhoodRatings = Record<NeedId, number>;

/** Оценка ≤ этого значения считается дефицитом потребности в детстве. */
export const LOW_NEED_MAX = 4;

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

/** Тон бейджа примера: красный — дефицит, зелёный — насыщение. */
export function exampleTone(score: number): 'low' | 'mid' | 'high' {
  if (score <= 3) return 'low';
  if (score < 8) return 'mid';
  return 'high';
}

/** Домен и схемы (по id из SCHEMA_DOMAINS), которые могут формироваться при дефиците потребности. */
export const CHILDHOOD_SCHEMA_HINTS: Record<
  NeedId,
  { domain: string; schemaIds: string[] }
> = {
  attachment: {
    domain: 'Нарушение связи и отвержение',
    schemaIds: [
      'abandonment',
      'mistrust',
      'emotional_deprivation',
      'defectiveness',
    ],
  },
  autonomy: {
    domain: 'Нарушенная автономия',
    schemaIds: ['dependence', 'failure', 'enmeshment'],
  },
  expression: {
    domain: 'Направленность на других + Бдительность',
    schemaIds: [
      'subjugation',
      'self_sacrifice',
      'emotion_inhibition_fear',
      'emotional_inhibition',
      'approval_seeking',
    ],
  },
  play: {
    domain: 'Сверхбдительность и подавление эмоций',
    schemaIds: [
      'unrelenting_standards',
      'negativity',
      'punitiveness_self',
      'punitiveness_others',
    ],
  },
  limits: {
    domain: 'Нарушенные границы',
    schemaIds: ['entitlement', 'insufficient_self_control'],
  },
};

export function hintSchemas(id: NeedId): FlatSchema[] {
  return CHILDHOOD_SCHEMA_HINTS[id].schemaIds
    .map((sid) => ALL_SCHEMAS.find((s) => s.id === sid))
    .filter((s): s is FlatSchema => !!s);
}
