import { useCallback, useEffect, useRef } from 'react';
import type { UserId } from '../../api';
import type { ClientConceptState } from './clientConceptContext';
import { addedOnCanvas, isEmptyCanvas, type CanvasConcept, type ConceptResponse } from './conceptSync';
import { useAppendQueue, type AppendLive } from './useAppendQueue';

export { BACK_SYNC_DELAY_MS } from './useAppendQueue';

interface Params {
  clientId: UserId | null | undefined;
  /** Не карта пары и есть клиент. */
  enabled: boolean;
  canvas: CanvasConcept;
  concept: ClientConceptState;
  /** Ответ сервера — концептуализация целиком, с уже объединённым. */
  onSaved: (c: ConceptResponse) => void;
}

/**
 * Холст → поля (#963). В концептуализацию уходит только то, что ПОЯВИЛОСЬ на
 * холсте: каждое изменение сравнивается с прошлым состоянием холста, а не с
 * полями целиком — иначе режим, который терапевт убрал из полей, а на карте
 * оставил, возвращался бы в поля при каждом открытии карты. Открытие карты —
 * базовая линия, удаление с холста ничего не пишет. Запись — append: сервер
 * объединяет и ничего не удаляет; отправка, по одному запросу за раз, — useAppendQueue.
 */
export function useConceptBackSync({ clientId, enabled, canvas, concept, onSaved }: Params) {
  const live = useRef<AppendLive>({ canvas, concept, onSaved });
  useEffect(() => { live.current = { canvas, concept, onSaved }; });
  const prev = useRef<CanvasConcept | null>(null);
  const { status, lastAdded, add, retry: retryFor, markToMap } = useAppendQueue(live);

  useEffect(() => {
    if (!enabled || clientId == null) { prev.current = null; return; }
    const before = prev.current;
    prev.current = canvas;
    if (!before) return; // открытие карты: ничего не пишем
    const added = addedOnCanvas(before, canvas);
    if (!isEmptyCanvas(added)) add(clientId, added);
  }, [canvas, enabled, clientId, add]);

  const retry = useCallback(() => { if (clientId != null) retryFor(clientId); }, [clientId, retryFor]);
  return { status, lastAdded, retry, markToMap };
}
