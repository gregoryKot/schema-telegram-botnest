import { useCallback, useEffect, useRef, useState } from 'react';
import { api, reportClientError, type ClientConceptualization, type UserId } from '../../api';
import { usePendingSave } from '../../../../shared/src/utils/usePendingSave';
import type { ConceptAppendBody } from '../../../../shared/src/therapy/conceptAppend';
import type { ClientConceptState } from './clientConceptContext';
import { announceConceptAppended } from './conceptAppendedEvent';
import type { BackSyncStatus } from './conceptSyncContext';
import {
  EMPTY_CANVAS, addedOnCanvas, appendBody, isEmptyCanvas, keepOnCanvas, unionCanvas,
  type CanvasConcept, type ConceptResponse,
} from './conceptSync';

/** Пауза перед записью: фигура из палитры и линия к ней следом уходят одним запросом. */
export const BACK_SYNC_DELAY_MS = 800;
const SECTION = 'therapist.modeMap';
const why = (e: unknown) => (e instanceof Error ? e.message : 'unknown');

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
 * объединяет и ничего не удаляет. Отложенная отправка и досылка при уходе —
 * общая механика usePendingSave; отказ виден («failed») и уходит в телеметрию,
 * несписанное ждёт «Повторить» или следующей правки.
 */
export function useConceptBackSync({ clientId, enabled, canvas, concept, onSaved }: Params) {
  const [status, setStatus] = useState<BackSyncStatus>('idle');
  const [lastAdded, setLastAdded] = useState<ConceptAppendBody | null>(null);
  const live = useRef({ canvas, concept, onSaved });
  useEffect(() => { live.current = { canvas, concept, onSaved }; });
  const prev = useRef<CanvasConcept | null>(null);
  const pending = useRef<CanvasConcept>(EMPTY_CANVAS);
  const seq = useRef(0);

  // Ответы могут прийти не по порядку: концептуализацию заменяет только последний запрос —
  // и здесь, и во вкладке «Концептуализация» (announceConceptAppended).
  function accepted(id: UserId, saved: ClientConceptualization, body: ConceptAppendBody, mine: number) {
    if (mine === seq.current) {
      live.current.onSaved(saved);
      announceConceptAppended({ clientId: id, concept: saved });
    }
    setLastAdded(body);
    api.trackEvent('concept_sync_from_map');
  }

  async function send(id: UserId, added: CanvasConcept, { leaving }: { leaving: boolean }) {
    pending.current = EMPTY_CANVAS;
    const kept = keepOnCanvas(added, live.current.canvas);
    const body = appendBody(kept, live.current.concept);
    if (!body) return;
    const mine = ++seq.current;
    // Досылка при уходе (размонтирование, скрытая вкладка): keepalive, как у автосохранения полей; отказ — в onLeaveError.
    if (leaving) return api.appendConceptualization(id, body, { keepalive: true }).then((saved) => accepted(id, saved, body, mine));
    setStatus('sending');
    try {
      accepted(id, await api.appendConceptualization(id, body), body, mine);
      if (mine === seq.current) setStatus((st) => (st === 'sending' ? 'idle' : st));
    } catch (e) {
      pending.current = unionCanvas(pending.current, kept);
      setStatus('failed');
      reportClientError({ message: `concept append from map failed: ${why(e)}`, section: SECTION });
    }
  }

  const saver = usePendingSave<UserId, CanvasConcept>({
    delayMs: BACK_SYNC_DELAY_MS,
    send,
    onLeaveError: (e) => reportClientError({ message: `concept append on leave failed: ${why(e)}`, section: SECTION }),
  });

  useEffect(() => {
    if (!enabled || clientId == null) { prev.current = null; return; }
    const before = prev.current;
    prev.current = canvas;
    if (!before) return; // открытие карты: ничего не пишем
    const added = addedOnCanvas(before, canvas);
    if (isEmptyCanvas(added)) return;
    pending.current = unionCanvas(pending.current, added);
    saver.schedule(clientId, pending.current);
  }, [canvas, enabled, clientId, saver]);

  const retry = useCallback(() => {
    setStatus((s) => (s === 'failed' ? 'idle' : s));
    if (clientId == null) return;
    saver.schedule(clientId, pending.current);
    saver.flush();
  }, [clientId, saver]);
  const markToMap = useCallback(() => setLastAdded(null), []);

  return { status, lastAdded, retry, markToMap };
}
