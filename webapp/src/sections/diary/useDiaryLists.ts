import { useCallback, useState } from 'react';
import type { SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../../types';
import { api } from '../../api';
import type { DiaryKind, DiaryPage } from '../../../../shared/src/api/entryApi';
import { mergePage, refreshFirstPage } from './diaryPages';

// Три дневника экрана «Записи» постранично (R6, аудит 2026-11): список отдавал
// 30 последних записей, и старшие было не увидеть. Первая страница каждого
// дневника — с признаком «есть ещё» от сервера; «Показать ещё» догружает
// следующую страницу тех дневников, где он стоит, старше последней показанной.

export type MoreState = 'idle' | 'loading' | 'failed';
type FirstPages = [DiaryPage<SchemaDiaryEntry>, DiaryPage<ModeDiaryEntry>, DiaryPage<GratitudeDiaryEntry>];
type Lists = { schema: SchemaDiaryEntry[]; mode: ModeDiaryEntry[]; gratitude: GratitudeDiaryEntry[]; more: Record<DiaryKind, boolean> };
type Update<T> = (fn: (prev: T[]) => T[]) => void;
const EMPTY: Lists = { schema: [], mode: [], gratitude: [], more: { schema: false, mode: false, gratitude: false } };
const byCreated = (r: { createdAt: string }) => r.createdAt;
const byDate = (r: GratitudeDiaryEntry) => r.date;

export const fetchFirstDiaryPages = (): Promise<FirstPages> =>
  Promise.all([api.getDiaryPage('schema'), api.getDiaryPage('mode'), api.getDiaryPage('gratitude')]);

/** Курсор следующей страницы — самая старая показанная запись (список «новые сверху»). */
export const oldestId = (rows: { id: number }[]): number | undefined => rows[rows.length - 1]?.id;

export function useDiaryLists() {
  const [lists, setLists] = useState<Lists>(EMPTY);
  const [moreState, setMoreState] = useState<MoreState>('idle');
  const { schema, mode, gratitude, more } = lists;

  const setSchema = useCallback<Update<SchemaDiaryEntry>>((fn) => setLists((l) => ({ ...l, schema: fn(l.schema) })), []);
  const setMode = useCallback<Update<ModeDiaryEntry>>((fn) => setLists((l) => ({ ...l, mode: fn(l.mode) })), []);
  const setGratitude = useCallback<Update<GratitudeDiaryEntry>>((fn) => setLists((l) => ({ ...l, gratitude: fn(l.gratitude) })), []);

  const applyFirst = useCallback(([s, m, g]: FirstPages) => {
    setLists((l) => {
      const ns = refreshFirstPage(l.schema, l.more.schema, s, byCreated);
      const nm = refreshFirstPage(l.mode, l.more.mode, m, byCreated);
      const ng = refreshFirstPage(l.gratitude, l.more.gratitude, g, byDate);
      return { schema: ns.rows, mode: nm.rows, gratitude: ng.rows, more: { schema: ns.more, mode: nm.more, gratitude: ng.more } };
    });
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
      setLists((l) => ({
        schema: s ? mergePage(l.schema, s.items, byCreated) : l.schema,
        mode: m ? mergePage(l.mode, m.items, byCreated) : l.mode,
        gratitude: g ? mergePage(l.gratitude, g.items, byDate) : l.gratitude,
        more: { schema: s ? s.hasMore : l.more.schema, mode: m ? m.hasMore : l.more.mode, gratitude: g ? g.hasMore : l.more.gratitude },
      }));
      setMoreState('idle');
    } catch (err) {
      console.error(err);
      setMoreState('failed'); // кнопка остаётся: повтор возьмёт тот же курсор
    }
  };

  const hasMore = more.schema || more.mode || more.gratitude;
  return { schema, setSchema, mode, setMode, gratitude, setGratitude, more, hasMore, moreState, applyFirst, loadMore };
}
