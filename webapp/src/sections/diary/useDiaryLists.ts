import { useCallback, useState } from 'react';
import type { SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../../types';
import { api } from '../../api';
import type { DiaryKind, DiaryPage } from '../../../../shared/src/api/entryApi';

// Три дневника экрана «Записи» постранично (R6, аудит 2026-11): список отдавал
// 30 последних записей, и старшие было не увидеть. Первая страница каждого
// дневника — с признаком «есть ещё» от сервера; «Показать ещё» догружает
// следующую страницу тех дневников, где он стоит, старше последней показанной.

export type MoreState = 'idle' | 'loading' | 'failed';
type FirstPages = [DiaryPage<SchemaDiaryEntry>, DiaryPage<ModeDiaryEntry>, DiaryPage<GratitudeDiaryEntry>];
const NO_MORE: Record<DiaryKind, boolean> = { schema: false, mode: false, gratitude: false };

export const fetchFirstDiaryPages = (): Promise<FirstPages> =>
  Promise.all([api.getDiaryPage('schema'), api.getDiaryPage('mode'), api.getDiaryPage('gratitude')]);

/** Курсор следующей страницы — самая старая показанная запись (список «новые сверху»). */
export const oldestId = (rows: { id: number }[]): number | undefined => rows[rows.length - 1]?.id;

/** Страница встаёт в хвост; запись, уже стоящая в списке, не дублируется. */
export function appendPage<T extends { id: number }>(rows: T[], page: T[]): T[] {
  const seen = new Set(rows.map((r) => r.id));
  return [...rows, ...page.filter((r) => !seen.has(r.id))];
}

export function useDiaryLists() {
  const [schema, setSchema] = useState<SchemaDiaryEntry[]>([]);
  const [mode, setMode] = useState<ModeDiaryEntry[]>([]);
  const [gratitude, setGratitude] = useState<GratitudeDiaryEntry[]>([]);
  const [more, setMore] = useState(NO_MORE);
  const [moreState, setMoreState] = useState<MoreState>('idle');

  const applyFirst = useCallback(([s, m, g]: FirstPages) => {
    setSchema(s.items);
    setMode(m.items);
    setGratitude(g.items);
    setMore({ schema: s.hasMore, mode: m.hasMore, gratitude: g.hasMore });
    setMoreState('idle');
  }, []);

  const loadMore = async () => {
    setMoreState('loading');
    try {
      const [s, m, g] = await Promise.all([
        more.schema ? api.getDiaryPage('schema', oldestId(schema)) : null,
        more.mode ? api.getDiaryPage('mode', oldestId(mode)) : null,
        more.gratitude ? api.getDiaryPage('gratitude', oldestId(gratitude)) : null,
      ]);
      if (s) setSchema((p) => appendPage(p, s.items));
      if (m) setMode((p) => appendPage(p, m.items));
      if (g) setGratitude((p) => appendPage(p, g.items));
      setMore((p) => ({
        schema: s ? s.hasMore : p.schema,
        mode: m ? m.hasMore : p.mode,
        gratitude: g ? g.hasMore : p.gratitude,
      }));
      setMoreState('idle');
    } catch (err) {
      console.error(err);
      setMoreState('failed'); // кнопка остаётся: повтор возьмёт тот же курсор
    }
  };

  const hasMore = more.schema || more.mode || more.gratitude;
  return { schema, setSchema, mode, setMode, gratitude, setGratitude, hasMore, moreState, applyFirst, loadMore };
}
