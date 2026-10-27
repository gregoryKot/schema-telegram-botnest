import { dayIndex } from '../../needs/dayIndex';
import { NEED_ORDER } from '../../needs/types';
import { getModeById } from '../../schemaTherapy/schemaTherapyData';
import type { DayHistory, ModeDiaryEntry } from '../../types';
import { pluralRu } from '../../utils/pluralRu';

// Когда приложению стоит самому предложить разговор с живым человеком
// (docs/design/CLIENT_SIMPLE_2026-10.md, «Мост к терапевту»). Чистая функция:
// всё, что нужно, приходит аргументом.

export type TherapySignalTrigger = 'low_index' | 'repeat_mode' | 'crisis';

export interface TherapySignal {
  trigger: TherapySignalTrigger;
  /** Строка над заголовком карточки: что именно заметили. */
  eyebrow: string;
  /** Для repeat_mode — режим, который повторяется. */
  modeId?: string;
}

export interface TherapySignalInput {
  /** `/api/history?days=14`. */
  history: DayHistory[];
  modeEntries: ModeDiaryEntry[];
  /** ISO-момент последнего кризисного текста (локально, therapyBridgeState). */
  crisisSeenAt: string | null;
  /** ISO-момент, до которого пользователь скрыл карточку. */
  dismissedUntil: string | null;
  now: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Меньше стольких дней с оценками — новичку ничего не предлагаем. */
export const MIN_RATED_DAYS = 5;
export const LOW_INDEX_MAX = 4;
export const LOW_INDEX_DAYS = 3;
export const REPEAT_MODE_MIN = 3;
export const REPEAT_WINDOW_DAYS = 14;
export const CRISIS_WINDOW_DAYS = 7;

const ratedOnly = (ratings: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(ratings).filter(([, v]) => v > 0));

function parseMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Индексы заполненных (все пять оценены) дней, свежие первыми. */
function filledIndexes(history: DayHistory[]): number[] {
  return [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((d) => dayIndex(NEED_ORDER, ratedOnly(d.ratings)))
    .filter((v): v is number => v !== null);
}

function hasLowIndexStreak(history: DayHistory[]): boolean {
  const last = filledIndexes(history).slice(0, LOW_INDEX_DAYS);
  return (
    last.length === LOW_INDEX_DAYS && last.every((v) => v <= LOW_INDEX_MAX)
  );
}

/** Режим из ≥3 записей за две недели; здоровые режимы (Здоровый Взрослый, Счастливый Ребёнок) не считаются. */
function repeatedMode(
  entries: ModeDiaryEntry[],
  nowMs: number,
): { modeId: string; count: number } | null {
  const since = nowMs - REPEAT_WINDOW_DAYS * DAY_MS;
  const stats = new Map<string, { count: number; last: number }>();
  for (const e of entries) {
    const at = parseMs(e.createdAt);
    if (at === null || at < since || at > nowMs + DAY_MS) continue;
    const mode = getModeById(e.modeId);
    if (!mode || mode.groupId === 'healthy') continue;
    const cur = stats.get(e.modeId) ?? { count: 0, last: 0 };
    stats.set(e.modeId, { count: cur.count + 1, last: Math.max(cur.last, at) });
  }
  let best: { modeId: string; count: number; last: number } | null = null;
  for (const [modeId, s] of stats) {
    if (s.count < REPEAT_MODE_MIN) continue;
    if (
      !best ||
      s.count > best.count ||
      (s.count === best.count && s.last > best.last)
    ) {
      best = { modeId, ...s };
    }
  }
  return best ? { modeId: best.modeId, count: best.count } : null;
}

export function repeatModeEyebrow(modeName: string, count: number): string {
  return `${modeName} — ${count} ${pluralRu(count, 'раз', 'раза', 'раз')} за две недели`;
}

export function detectTherapySignal(
  input: TherapySignalInput,
): TherapySignal | null {
  const { history, modeEntries, crisisSeenAt, dismissedUntil, now } = input;
  const nowMs = now.getTime();

  const until = parseMs(dismissedUntil);
  if (until !== null && until > nowMs) return null;

  const ratedDays = history.filter(
    (d) => Object.keys(ratedOnly(d.ratings)).length > 0,
  );
  if (ratedDays.length < MIN_RATED_DAYS) return null;

  const crisisMs = parseMs(crisisSeenAt);
  if (
    crisisMs !== null &&
    crisisMs <= nowMs + DAY_MS &&
    nowMs - crisisMs <= CRISIS_WINDOW_DAYS * DAY_MS
  ) {
    return { trigger: 'crisis', eyebrow: 'После тяжёлого дня' };
  }

  if (hasLowIndexStreak(history)) {
    return { trigger: 'low_index', eyebrow: 'Три дня подряд индекс не выше 4' };
  }

  const repeat = repeatedMode(modeEntries, nowMs);
  if (repeat) {
    const name = getModeById(repeat.modeId)?.name ?? '';
    return {
      trigger: 'repeat_mode',
      eyebrow: repeatModeEyebrow(name, repeat.count),
      modeId: repeat.modeId,
    };
  }
  return null;
}
