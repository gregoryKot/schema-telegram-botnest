// Содержимое записи для карточки-результата «Моего пути». Лента с бэка
// намеренно не несёт свободный текст — он подтягивается здесь, через обычные
// расшифровывающие эндпоинты, ТОЛЬКО по явному тапу пользователя на записи
// (и перед отправкой виден в превью, как у карточки благодарности).
import { type JourneyItem, JOURNEY_NEED_NAMES } from './journeyMeta';
import {
  SCHEMAS,
  type YsqHistoryEntry,
  countActiveInHistory,
} from '../hooks/useYsqTest';

export interface JourneyResultPart {
  title?: string;
  text: string;
}

// Минимальные структурные типы записей — оба api-клиента им соответствуют.
export interface JourneyContentApi {
  getSchemaDiary(): Promise<
    Array<{ id: number; trigger: string; healthyView?: string | null }>
  >;
  getModeDiary(): Promise<
    Array<{ id: number; situation: string; actualNeed?: string | null }>
  >;
  getGratitudeDiary(): Promise<Array<{ id: number; items: string[] }>>;
  getBeliefChecks(): Promise<
    Array<{ id: number; belief: string; reframe?: string | null }>
  >;
  getLetters(): Promise<Array<{ id: number; text: string }>>;
  getFlashcards(): Promise<
    Array<{ id: number; reflection?: string | null; action?: string | null }>
  >;
  getSafePlace(): Promise<{ description: string } | null>;
  getNote(date: string): Promise<{ text: string | null }>;
  getPractices(needId: string): Promise<Array<{ id: number; text: string }>>;
  getPlanHistory(
    days?: number,
  ): Promise<Array<{ id: number; practiceText: string }>>;
  ratings(date?: string): Promise<Record<string, number>>;
  getSchemaNotes(): Promise<Array<{ schemaId: string }>>;
  getModeNotes(): Promise<Array<{ modeId: string }>>;
  getYsqHistory(): Promise<YsqHistoryEntry[]>;
}

const EXCERPT = 220;
const cut = (s: string): string =>
  s.length > EXCERPT ? `${s.slice(0, EXCERPT).trimEnd()}…` : s;

const part = (text: string | null | undefined, title?: string) =>
  text?.trim() ? [{ title, text: cut(text.trim()) }] : [];

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

/**
 * Тянет запись по item.id (или дате) и собирает части карточки.
 * null — содержимого нет (трекер, тест) или запись не нашлась: тогда
 * показывается обычная карточка шага.
 */
export async function fetchJourneyResult(
  api: JourneyContentApi,
  item: JourneyItem,
): Promise<JourneyResultPart[] | null> {
  const byId = <T extends { id: number }>(rows: T[]): T | undefined =>
    rows.find((r) => r.id === item.id);
  let entry: unknown;
  switch (item.type) {
    case 'schema_diary':
      entry = byId(await api.getSchemaDiary());
      break;
    case 'mode_diary':
      entry = byId(await api.getModeDiary());
      break;
    case 'gratitude':
      entry = byId(await api.getGratitudeDiary());
      break;
    case 'belief_check':
      entry = byId(await api.getBeliefChecks());
      break;
    case 'letter':
      entry = byId(await api.getLetters());
      break;
    case 'flashcard':
      entry = byId(await api.getFlashcards());
      break;
    case 'safe_place':
      entry = await api.getSafePlace();
      break;
    case 'note':
      entry = await api.getNote(item.at.slice(0, 10));
      break;
    case 'practice':
      entry = item.needId ? byId(await api.getPractices(item.needId)) : null;
      break;
    case 'plan_done':
      entry = byId(await api.getPlanHistory(365));
      break;
    case 'tracker_day':
      entry = await api.ratings(item.at.slice(0, 10));
      break;
    case 'schema_note': {
      const schemaId = item.schemaIds?.[0];
      entry = schemaId
        ? (await api.getSchemaNotes()).find((n) => n.schemaId === schemaId)
        : null;
      break;
    }
    case 'mode_note':
      entry = (await api.getModeNotes()).find((n) => n.modeId === item.modeId);
      break;
    case 'ysq':
      entry = item.id
        ? (await api.getYsqHistory()).find((h) => h.id === item.id)
        : null;
      break;
    default:
      return null;
  }
  const parts = buildJourneyResultParts(item.type, entry);
  return parts.length ? parts : null;
}
