import { fmtAgo, momentTime } from '../../utils/format';
import { isDiaryToday } from '../../../../shared/src/diary/diaryDay';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { dayIndex } from '../../../../shared/src/needs/dayIndex';
import { modeEntryKind, schemaEntryKind, type EntryKind } from '../diary/entryKind';

// Чистые вычисления главной «Сегодня»: лента дня и мета-строки трёх плиток.
// Только реальные данные: нет оценок и записей — нет и строк.
// «Сегодня» дневников — местный день человека (`isDiaryToday`): дату
// благодарности пишут местным днём, гринвичский день её теряет в 00:00–03:00 МСК.

/** Тип строки и его ярлык — общие с «Записями» (sections/diary/entryKind.ts). */
export interface FeedEntry {
  key: string;
  kind: EntryKind;
  /** «14:30»; у трекера и благодарности без момента — пусто. */
  time: string;
  text: string;
  /** Момент для сортировки; пусто — у строк без времени (идут после остальных). */
  sortKey: string;
}

export interface DiarySources {
  schema: Array<{ id: number; trigger: string; createdAt: string; schemaIds: string[]; emotions: unknown[] }>;
  mode: Array<{ id: number; situation: string; createdAt: string; fromCase?: boolean }>;
  gratitude: Array<{ id: number; items: string[]; date: string; createdAt: string }>;
}

export interface TrackerSummary { filled: number; total: number; index: number | null }

const TEXT_MAX = 80;

/** Индекс дня с запятой: 6,8. */
export function fmtIndex(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function trackerSummary(needIds: string[], ratings: Record<string, number>): TrackerSummary {
  return {
    filled: needIds.filter(id => ratings[id] !== undefined).length,
    total: needIds.length,
    index: dayIndex(needIds, ratings),
  };
}

/** Записи трёх дневников за сегодня. Разбор «Что случилось» пишет в дневник режимов с маркером fromCase. */
export function buildDiaryFeed({ schema, mode, gratitude }: DiarySources): FeedEntry[] {
  return [
    ...schema.filter(e => isDiaryToday(e.createdAt)).map(e => ({
      key: `schema-${e.id}`, kind: schemaEntryKind(e), time: momentTime(e.createdAt),
      text: e.trigger.slice(0, TEXT_MAX), sortKey: e.createdAt,
    })),
    ...mode.filter(e => isDiaryToday(e.createdAt)).map(e => ({
      key: `mode-${e.id}`, kind: modeEntryKind(e), time: momentTime(e.createdAt),
      text: e.situation.slice(0, TEXT_MAX), sortKey: e.createdAt,
    })),
    ...gratitude.filter(e => isDiaryToday(e.date)).map(e => ({
      key: `gratitude-${e.id}`, kind: 'gratitude' as const, time: momentTime(e.createdAt),
      text: (e.items[0] ?? 'Благодарность').slice(0, TEXT_MAX), sortKey: e.createdAt,
    })),
  ];
}

/** Лента дня: записи со временем — свежие первыми, строки без времени (трекер) — после них. */
export function buildTodayFeed(diary: FeedEntry[], tracker: TrackerSummary): FeedEntry[] {
  const rows = [...diary];
  if (tracker.filled > 0) {
    const done = tracker.total > 0 && tracker.filled >= tracker.total && tracker.index !== null;
    rows.push({
      key: 'tracker',
      kind: 'tracker',
      time: '',
      sortKey: '',
      text: done
        ? `Трекер заполнен — индекс ${fmtIndex(tracker.index as number)}`
        : `Трекер: ${tracker.filled} из ${tracker.total}`,
    });
  }
  return rows.sort((a, b) => {
    if (a.sortKey && b.sortKey) return b.sortKey.localeCompare(a.sortKey);
    if (a.sortKey) return -1;
    if (b.sortKey) return 1;
    return 0;
  });
}

// ── Мета-строки плиток ──────────────────────────────────────────────────────

export function trackerTileMeta({ filled, total, index }: TrackerSummary): string {
  if (filled === 0 || total === 0) return 'Ещё не заполнен · ≈1 мин';
  if (filled < total) return `Заполнено ${filled} из ${total} · продолжить`;
  return index === null ? 'Готово' : `Готово · индекс ${fmtIndex(index)}`;
}

/** Записей дневника за сегодня: разбор и трекер — не они («Записи» относят разбор к «Случаям»). */
export function diaryEntriesToday(feed: FeedEntry[]): number {
  return feed.filter(e => e.kind !== 'case' && e.kind !== 'tracker').length;
}

/** Есть разборы за сегодня (запись режима с fromCase) — считаем их; нет — обещание. */
export function caseTileMeta(casesToday = 0): string {
  if (casesToday > 0) return `Сегодня: ${casesToday} ${pluralRu(casesToday, 'разбор', 'разбора', 'разборов')}`;
  return '≈3 мин · когда что-то зацепило';
}

/** Сколько разборов записано за сегодня. */
export function casesTodayCount({ mode }: Pick<DiarySources, 'mode'>): number {
  return mode.filter(e => e.fromCase && isDiaryToday(e.createdAt)).length;
}

/** null — пока дневники грузятся (плитка показывает плашку-скелетон вместо выдуманного текста). */
export function diaryTileMeta(loaded: boolean, todayCount: number, lastAt: string | null): string | null {
  if (!loaded) return null;
  if (todayCount > 0) return `Сегодня ${todayCount} ${pluralRu(todayCount, 'запись', 'записи', 'записей')}`;
  if (lastAt) return `Последняя запись — ${fmtAgo(lastAt)}`;
  return 'Пока записей нет';
}

/** Самый поздний момент среди записей трёх дневников (за всё время), разборы не в счёт. */
export function lastEntryAt({ schema, mode, gratitude }: DiarySources): string | null {
  const diaryMode = mode.filter(e => modeEntryKind(e) === 'mode');
  const all = [...schema, ...diaryMode, ...gratitude].map(e => e.createdAt).filter(Boolean);
  return all.length === 0 ? null : all.reduce((a, b) => (a > b ? a : b));
}
