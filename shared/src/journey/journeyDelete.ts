// Удаление записи «Моего пути» — общая логика для обоих фронтендов
// (правило №3). Пока удаляемы только упражнения с собственным DELETE-роутом
// на бэке: проверка убеждения, письмо себе, кризисная карточка.
import { useCallback, useState } from 'react';
import type { JourneyItem } from './journeyMeta';
import {
  ENTRY_DELETED_EVENT,
  type JourneyDeletableType,
} from '../share/analytics';

// Тип-источник — JourneyDeletableType в analytics.ts (там же живёт парный
// allow-list на бэке); список ниже — рантайм-значения того же множества.
export const JOURNEY_DELETABLE_TYPES = [
  'belief_check',
  'letter',
  'flashcard',
] as const satisfies readonly JourneyDeletableType[];

export function isJourneyDeletable(type: string): type is JourneyDeletableType {
  return (JOURNEY_DELETABLE_TYPES as readonly string[]).includes(type);
}

// Минимальный структурный тип — оба api-клиента ему соответствуют без
// изменений (не расширяем JourneyContentApi, чтобы не растить journeyContent.ts).
export interface JourneyDeleteApi {
  deleteBeliefCheck(id: number): Promise<unknown>;
  deleteLetter(id: number): Promise<unknown>;
  deleteFlashcard(id: number): Promise<unknown>;
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

function callDelete(
  api: JourneyDeleteApi,
  type: JourneyDeletableType,
  id: number,
): Promise<unknown> {
  switch (type) {
    case 'belief_check':
      return api.deleteBeliefCheck(id);
    case 'letter':
      return api.deleteLetter(id);
    case 'flashcard':
      return api.deleteFlashcard(id);
  }
}

export interface JourneyDeleteState {
  busy: boolean;
  failed: boolean;
  remove: (item: JourneyItem) => void;
}

/**
 * remove() удаляет запись через API и на успехе шлёт trackEvent + onDeleted
 * (закрыть детальный просмотр, перезагрузить ленту). На неудаче запись
 * остаётся видимой — onDeleted НЕ вызывается, failed = true до следующей
 * попытки. trackEvent — fire-and-forget: его сбой не превращает успешное
 * удаление в неудачу (правило №8: событие не должно мешать продукту).
 */
export function useJourneyDelete(
  api: JourneyDeleteApi,
  onDeleted: () => void,
): JourneyDeleteState {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const remove = useCallback(
    (item: JourneyItem) => {
      if (busy || !item.id || !isJourneyDeletable(item.type)) return;
      const type = item.type;
      const id = item.id;
      setBusy(true);
      setFailed(false);
      callDelete(api, type, id)
        .then(() => {
          try {
            api.trackEvent(ENTRY_DELETED_EVENT, { type });
          } catch {
            // fire-and-forget — сбой трекинга не должен маскировать успех
          }
          setBusy(false);
          onDeleted();
        })
        .catch(() => {
          setBusy(false);
          setFailed(true);
        });
    },
    [api, busy, onDeleted],
  );

  return { busy, failed, remove };
}
