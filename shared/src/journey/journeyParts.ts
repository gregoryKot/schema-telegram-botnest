// Чистая сборка содержимого записи «Моего пути» для карточек: короткие части
// для карточки шаринга, полные — для детального просмотра, и счёт теста на
// схемы для карточки-профиля. Ни одного обращения к api — только разбор уже
// полученной записи (поэтому целиком покрыто тестами).
import {
  SCHEMAS,
  type YsqHistoryEntry,
  countActiveInHistory,
  historyScoresByName,
} from '../hooks/useYsqTest';
import { JOURNEY_NEED_NAMES } from './journeyMeta';
import { DETAIL_FIELDS } from './journeyDetailFields';

export interface JourneyResultPart {
  title?: string;
  text: string;
}

export type YsqScore = { pct5plus: number; avg: number };

const EXCERPT = 220;
const cut = (s: string): string =>
  s.length > EXCERPT ? `${s.slice(0, EXCERPT).trimEnd()}…` : s;

const part = (text: string | null | undefined, title?: string) =>
  text?.trim() ? [{ title, text: cut(text.trim()) }] : [];

/**
 * Счёт теста из записи истории — для карточки-профиля всех 20 схем.
 * null, если записи нет, счёта нет или в нём нет ни одного среднего балла:
 * у совсем старых записей avg не сохранялся, и профиль вышел бы из двадцати
 * прочерков — такому шагу честнее остаться текстовой карточкой.
 * Чистая (тестируется).
 */
export function ysqResultFromEntry(
  entry: unknown,
): { scores: Record<string, YsqScore>; activeCount: number } | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;
  if (!Array.isArray(e.scores) || e.scores.length === 0) return null;
  const hasAvg = e.scores.some(
    (s): boolean =>
      typeof (s as { avg?: unknown }).avg === 'number' &&
      (s as { avg: number }).avg >= 1,
  );
  if (!hasAvg) return null;
  const history = e as unknown as YsqHistoryEntry;
  return {
    scores: historyScoresByName(history),
    activeCount: countActiveInHistory(history),
  };
}

/** Части карточки-результата из уже найденной записи. Чистая (тестируется). */
export function buildJourneyResultParts(
  type: string,
  entry: unknown,
): JourneyResultPart[] {
  if (!entry || typeof entry !== 'object') return [];
  const e = entry as Record<string, unknown>;
  const str = (k: string) => {
    const v = e[k];
    return typeof v === 'string' ? v : '';
  };
  switch (type) {
    case 'schema_diary':
      return [
        ...part(str('trigger'), 'Ситуация'),
        ...part(str('healthyView'), 'Здоровый взгляд'),
      ];
    case 'mode_diary':
      return [
        ...part(str('situation'), 'Ситуация'),
        ...part(str('actualNeed'), 'Что было нужно'),
      ];
    case 'gratitude': {
      const items = Array.isArray(e.items)
        ? e.items.filter((i): i is string => typeof i === 'string')
        : [];
      return items.slice(0, 3).map((text) => ({ text: cut(text) }));
    }
    case 'belief_check':
      return [
        ...part(str('belief'), 'Убеждение'),
        ...part(str('reframe'), 'Здоровый взгляд'),
      ];
    case 'letter':
      return part(str('text'));
    case 'flashcard':
      return [
        ...part(str('reflection'), 'Напоминание себе'),
        ...part(str('action'), 'Что делать'),
      ];
    case 'safe_place':
      return part(str('description'));
    case 'note':
      return part(str('text'));
    case 'practice':
      return part(str('text'), 'Моя практика');
    case 'plan_done':
      return part(str('practiceText'), 'Практика');
    case 'tracker_day': {
      // entry = Record<needId, value> — оценки дня из /api/ratings?date=…
      const line = Object.entries(JOURNEY_NEED_NAMES)
        .filter(([needId]) => typeof e[needId] === 'number')
        .map(([needId, name]) => `${name} — ${e[needId] as number}`)
        .join(' · ');
      return line ? [{ title: 'Оценки дня (из 10)', text: line }] : [];
    }
    case 'schema_note':
      return [
        ...part(str('triggers'), 'Триггеры'),
        ...part(str('healthyView'), 'Здоровый взгляд'),
        ...part(str('behavior'), 'Что помогает'),
      ];
    case 'mode_note':
      return [
        ...part(str('triggers'), 'Триггеры'),
        ...part(str('needs'), 'Что мне нужно'),
        ...part(str('behavior'), 'Что помогает'),
      ];
    case 'ysq': {
      // entry = YsqHistoryEntry (id, scores)
      if (!Array.isArray(e.scores)) return [];
      const n = countActiveInHistory(e as unknown as YsqHistoryEntry);
      return [
        {
          title: 'Результат',
          text: `Выраженных схем: ${n} из ${SCHEMAS.length}`,
        },
      ];
    }
    default:
      return [];
  }
}

/** Части ДЕТАЛЬНОГО просмотра — все поля, без обрезки. Чистая (тестируется). */
export function buildJourneyDetailParts(
  type: string,
  entry: unknown,
): JourneyResultPart[] {
  if (!entry || typeof entry !== 'object') return [];
  const e = entry as Record<string, unknown>;
  const str = (k: string) => (typeof e[k] === 'string' ? e[k] : '');
  const fields = DETAIL_FIELDS[type];
  if (fields) {
    return fields.flatMap(([k, title]) =>
      str(k).trim() ? [{ title: title || undefined, text: str(k).trim() }] : [],
    );
  }
  if (type === 'gratitude') {
    const items = Array.isArray(e.items)
      ? e.items.filter((i): i is string => typeof i === 'string')
      : [];
    return items.map((text) => ({ text }));
  }
  // tracker_day / ysq — те же строки, что и в карточке (обрезка им не грозит).
  return buildJourneyResultParts(type, entry);
}
