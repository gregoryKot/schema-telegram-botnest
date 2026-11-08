// Содержимое записи для карточки-результата «Моего пути». Лента с бэка
// намеренно не несёт свободный текст — он подтягивается здесь, через обычные
// расшифровывающие эндпоинты, ТОЛЬКО по явному тапу пользователя на записи
// (и перед отправкой виден в превью, как у карточки благодарности).
// Запись с id открывается своим GET …/:id: поиск в списке находил только 30
// последних, и 31-я открывалась пустой (R6, аудит 2026-11); шаг плана искали
// в истории за год — старше года открывался пустым (хвост волны 2).
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

// Минимальные структурные типы записей — api-клиент им соответствует.
export interface JourneyContentApi {
  getSchemaDiaryEntry(
    id: number,
  ): Promise<{ trigger: string; healthyView?: string | null }>;
  getModeDiaryEntry(
    id: number,
  ): Promise<{ situation: string; actualNeed?: string | null }>;
  getGratitudeDiaryEntry(id: number): Promise<{ items: string[] }>;
  getBeliefCheck(
    id: number,
  ): Promise<{ belief: string; reframe?: string | null }>;
  getLetter(id: number): Promise<{ text: string }>;
  getFlashcard(
    id: number,
  ): Promise<{ reflection?: string | null; action?: string | null }>;
  getSafePlace(): Promise<{ description: string } | null>;
  getNote(date: string): Promise<{ text: string | null }>;
  getPractices(needId: string): Promise<Array<{ id: number; text: string }>>;
  getPlanEntry(id: number): Promise<{ practiceText: string }>;
  ratings(date?: string): Promise<Record<string, number>>;
  getSchemaNotes(): Promise<Array<{ schemaId: string }>>;
  getModeNotes(): Promise<Array<{ modeId: string }>>;
  getYsqHistoryEntry(id: number): Promise<YsqHistoryEntry>;
  getYsqResult(): Promise<{ answers: number[] } | null>;
}

type ById = (api: JourneyContentApi, id: number) => Promise<unknown>;
const BY_ID: Partial<Record<string, ById>> = {
  schema_diary: (a, id) => a.getSchemaDiaryEntry(id),
  mode_diary: (a, id) => a.getModeDiaryEntry(id),
  gratitude: (a, id) => a.getGratitudeDiaryEntry(id),
  belief_check: (a, id) => a.getBeliefCheck(id),
  letter: (a, id) => a.getLetter(id),
  flashcard: (a, id) => a.getFlashcard(id),
  plan_done: (a, id) => a.getPlanEntry(id),
};

/** 404 — запись удалили на другом устройстве: показать нечего, это не сбой. */
const missingAs404 = (p: Promise<unknown>): Promise<unknown> =>
  p.catch((e: unknown) => {
    if ((e as { status?: unknown } | null)?.status === 404) return null;
    throw e;
  });

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
  const own = BY_ID[item.type];
  if (own) return item.id ? missingAs404(own(api, item.id)) : null;
  let entry: unknown;
  switch (item.type) {
    case 'safe_place':
      entry = await api.getSafePlace();
      break;
    case 'note':
      entry = await api.getNote(item.at.slice(0, 10));
      break;
    case 'practice':
      entry = item.needId ? byId(await api.getPractices(item.needId)) : null;
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
      if (item.id) return missingAs404(api.getYsqHistoryEntry(item.id));
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
