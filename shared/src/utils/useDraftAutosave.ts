// Черновик формы упражнения — тот же механизм, что у дневников
// (SchemaEntrySheet: loadDraft в начальное состояние → saveDraft на каждое
// изменение → clearDraft после сохранения), собранный в один хук, чтобы
// четыре упражнения с текстом не повторяли его порознь. Хранилище и формат —
// drafts.ts. До QA 2026-11 «Письмо», «Безопасное место», «Проверка убеждения»
// и «Критик или забота?» держали текст только в useState: перезагрузка или
// «Назад» стирали 15–25 минут работы.
import { useCallback, useEffect } from 'react';
import { clearDraftAt, loadDraftAt, saveDraftAt } from './drafts';

/** Есть ли в черновике хоть один непустой текст. Числа и флаги — положение
 * формы (шаг, галочка), а не ввод: без текста черновик не нужен. */
export function hasDraftText(v: unknown): boolean {
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.some(hasDraftText);
  if (v && typeof v === 'object') return Object.values(v).some(hasDraftText);
  return false;
}

/** Данные черновика для начального состояния формы; null — черновика нет
 * (или он битый). Поля могут отсутствовать: форма старой версии. */
export function restoreDraft<T extends object>(key: string): Partial<T> | null {
  const data = loadDraftAt<unknown>(key)?.data;
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
}

/**
 * Пишет снимок формы в черновик при каждом изменении; снимок без текста
 * черновик стирает. Возвращает clear — звать после успешного сохранения:
 * снимок тот же, эффект не перезапустится, и уже сохранённое не всплывёт
 * черновиком. Правка после «Изменить» — снова изменение, снова черновик.
 */
export function useDraftAutosave(key: string, snapshot: object): () => void {
  const json = JSON.stringify(snapshot);
  useEffect(() => {
    const data: unknown = JSON.parse(json);
    if (hasDraftText(data)) saveDraftAt(key, data);
    else clearDraftAt(key);
  }, [key, json]);
  return useCallback(() => clearDraftAt(key), [key]);
}
