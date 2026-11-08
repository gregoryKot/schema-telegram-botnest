// Запись дневника, попытка теста и шаг плана по id, страница «Записей» (R6).
// Списки отдают последние 30 записей (тест — 20), а «Мой путь» перечисляет до
// 500: старая запись открывалась поиском в списке и приходила пустой. Отдельным
// модулем, а не строками в sharedApi.ts — по образцу practiceSessionsApi.ts:
// тот файл упирается в лимит размера (правило №10). Упражнения по id — рядом
// с их списками в webapp/src/api.ts.
import type { ApiTransport } from './sharedApi';
import type {
  SchemaDiaryEntry,
  ModeDiaryEntry,
  GratitudeDiaryEntry,
} from '../types';
import type { PracticePlan, YsqHistoryEntry } from '../apiTypes';

export type DiaryKind = 'schema' | 'mode' | 'gratitude';
export interface DiaryEntryOf {
  schema: SchemaDiaryEntry;
  mode: ModeDiaryEntry;
  gratitude: GratitudeDiaryEntry;
}
/** Ответ GET /api/diary/page/:kind (src/bot/diary-page.ts). */
export interface DiaryPage<T> {
  items: T[];
  hasMore: boolean;
}

export const createEntryApi = (t: ApiTransport) => ({
  /** Страница дневника; `before` — id записи, старше которой нужна страница. */
  getDiaryPage: <K extends DiaryKind>(kind: K, before?: number) =>
    t.get<DiaryPage<DiaryEntryOf[K]>>(
      `/api/diary/page/${kind}${before ? `?before=${before}` : ''}`,
    ),
  getSchemaDiaryEntry: (id: number) =>
    t.get<SchemaDiaryEntry>(`/api/diary/schema/${id}`),
  getModeDiaryEntry: (id: number) =>
    t.get<ModeDiaryEntry>(`/api/diary/mode/${id}`),
  getGratitudeDiaryEntry: (id: number) =>
    t.get<GratitudeDiaryEntry>(`/api/diary/gratitude/${id}`),
  getYsqHistoryEntry: (id: number) =>
    t.get<YsqHistoryEntry>(`/api/ysq-history/${id}`),
  getPlanEntry: (id: number) => t.get<PracticePlan>(`/api/plan/${id}`),
});
