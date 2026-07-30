// Содержимое записи для карточки-результата «Моего пути». Лента с бэка
// намеренно не несёт свободный текст — он подтягивается здесь, через обычные
// расшифровывающие эндпоинты, ТОЛЬКО по явному тапу пользователя на записи
// (и перед отправкой виден в превью, как у карточки благодарности).
import { type JourneyItem, JOURNEY_NEED_NAMES } from './journeyMeta';
import { computeScores, type YsqHistoryEntry } from '../hooks/useYsqTest';
// Разбор записи в части карточек — рядом, в journeyParts (реэкспорт ниже:
// у обоих фронтендов исторически один вход — этот модуль).
import {
  buildJourneyDetailParts,
  buildJourneyResultParts,
  ysqResultFromEntry,
  type JourneyResultPart,
  type YsqScore,
} from './journeyParts';

export {
  buildJourneyDetailParts,
  buildJourneyResultParts,
  ysqResultFromEntry,
} from './journeyParts';
export type { JourneyResultPart, YsqScore } from './journeyParts';

/** Результат записи для карточки шаринга: текстовые части + сырые данные для
 * тех шагов, у которых есть своя карточка вместо текста — оценки дня трекера
 * (радар потребностей) и счёт теста на схемы (профиль всех 20 схем). */
export interface JourneyResult {
  parts: JourneyResultPart[];
  ratings?: Record<string, number>;
  ysq?: { scores: Record<string, YsqScore>; activeCount: number };
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
  getYsqResult(): Promise<{ answers: number[] } | null>;
}

/**
 * Тянет запись по item.id (или дате): у каждого типа шага свой источник.
 * null — тип неизвестен; дальше сборщики частей решают, что показать.
 */
async function fetchJourneyEntry(
  api: JourneyContentApi,
  item: JourneyItem,
): Promise<unknown> {
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
    case 'ysq': {
      if (item.id) {
        entry = (await api.getYsqHistory()).find((h) => h.id === item.id);
        break;
      }
      // Старый пользователь: тест пройден до появления таблицы истории —
      // считаем выраженные схемы прямо из сохранённых ответов.
      const res = await api.getYsqResult();
      entry = res
        ? {
            id: 0,
            completedAt: item.at,
            scores: Object.entries(computeScores(res.answers)).map(
              ([id, sc]) => ({ id, pct5plus: sc.pct5plus, avg: sc.avg }),
            ),
          }
        : null;
      break;
    }
    default:
      return null;
  }
  return entry;
}

/** Части карточки (короткие, обрезанные) — по тапу для шаринга. Для
 * tracker_day дополнительно отдаёт сырые оценки — карточка рисует радар. */
export async function fetchJourneyResult(
  api: JourneyContentApi,
  item: JourneyItem,
): Promise<JourneyResult | null> {
  const entry = await fetchJourneyEntry(api, item);
  const parts = buildJourneyResultParts(item.type, entry);
  if (item.type === 'ysq') {
    const ysq = ysqResultFromEntry(entry);
    return ysq ? { parts, ysq } : null;
  }
  if (item.type === 'tracker_day') {
    const ratings = entry as Record<string, number> | undefined;
    const hasRatings =
      ratings &&
      Object.keys(JOURNEY_NEED_NAMES).some(
        (id) => typeof ratings[id] === 'number',
      );
    return hasRatings ? { parts, ratings } : null;
  }
  return parts.length ? { parts } : null;
}

/** Части детального просмотра (все поля, без обрезки). */
export async function fetchJourneyDetail(
  api: JourneyContentApi,
  item: JourneyItem,
): Promise<JourneyResultPart[]> {
  return buildJourneyDetailParts(item.type, await fetchJourneyEntry(api, item));
}
