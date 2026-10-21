import { useCallback, useEffect, useRef, useState } from 'react';
import type { GratitudeDiaryEntry } from '../types';
import { pickGratitudeInitialItems } from './gratitudeInitialItems';
import { loadDraft, saveDraft } from '../utils/drafts';

// Пункты формы благодарности + загрузка сохранённого дня (инцидент 2026-10-18).
// Инвариант «открытая форма показывает то, что уже сохранено за этот день»
// держит сама форма, а не точка входа: сервер заменяет пункты дня целиком, и
// вход без `existingItems` (например, из «плюса») иначе затирал бы утреннюю
// запись. Пока записи не загрузились (`loading`) или загрузка упала (`error`),
// сохранять нельзя — это решает форма по `status`.

export type GratitudeLoadStatus = 'loading' | 'ready' | 'error';

interface Options {
  date: string;
  /** Пункты, переданные точкой входа, — тогда загрузка не нужна. */
  existingItems?: string[];
  load: () => Promise<GratitudeDiaryEntry[]>;
}

export function useGratitudeItems({ date, existingItems, load }: Options) {
  const hasExisting = existingItems !== undefined;
  // Черновик нужен только новой записи и только как начальное значение.
  const [draftItems] = useState(() =>
    hasExisting
      ? null
      : (loadDraft<{ items: string[] }>('gratitude')?.data?.items ?? null),
  );
  const [items, setItems] = useState<string[]>(() =>
    hasExisting ? existingItems : pickGratitudeInitialItems(null, draftItems),
  );
  const [status, setStatus] = useState<GratitudeLoadStatus>(
    hasExisting ? 'ready' : 'loading',
  );
  const [attempt, setAttempt] = useState(0);
  // load и черновик не должны перезапускать загрузку при каждом рендере.
  const loadRef = useRef(load);
  const statusRef = useRef(status);
  loadRef.current = load;
  statusRef.current = status;

  useEffect(() => {
    if (existingItems !== undefined) {
      // Точка входа успела передать пункты, пока шла загрузка, — берём их.
      // Уже готовую форму не трогаем: человек мог начать печатать.
      if (statusRef.current !== 'ready') {
        setItems(existingItems);
        setStatus('ready');
      }
      return;
    }
    let cancelled = false;
    setStatus('loading');
    loadRef
      .current()
      .then((entries) => {
        if (cancelled) return;
        const saved = entries.find((e) => e.date === date)?.items ?? null;
        setItems(pickGratitudeInitialItems(saved, draftItems));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [date, existingItems, draftItems, attempt]);

  // Пока день не загружен, черновик не пишем: в полях ещё не то, что будет.
  useEffect(() => {
    if (!hasExisting && status === 'ready') saveDraft('gratitude', { items });
  }, [items, hasExisting, status]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { items, setItems, status, retry };
}
