import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api, reportClientError, type UserId } from '../../api';
import { usePendingSave } from '../../../../shared/src/utils/usePendingSave';
import type { ConceptAppendBody } from '../../../../shared/src/therapy/conceptAppend';
import type { ClientConceptState } from './clientConceptContext';
import { announceConceptAppended } from './conceptAppendedEvent';
import type { BackSyncStatus } from './conceptSyncContext';
import { EMPTY_CANVAS, appendBody, keepOnCanvas, unionCanvas, type CanvasConcept, type ConceptResponse } from './conceptSync';

/** Пауза перед записью: фигура из палитры и линия к ней следом уходят одним запросом. */
export const BACK_SYNC_DELAY_MS = 800;
const SECTION = 'therapist.modeMap';
const why = (e: unknown) => (e instanceof Error ? e.message : 'unknown');

export interface AppendLive { canvas: CanvasConcept; concept: ClientConceptState; onSaved: (c: ConceptResponse) => void }
type Flight = { kept: CanvasConcept; done: Promise<void> };

/**
 * Очередь записи холста в поля (#963): отложенная отправка и досылка при уходе
 * (общая механика usePendingSave, досылка — keepalive) и ОДИН запрос за раз.
 * Сервер дописывает чтением-записью в обычной изоляции: append, ушедший до
 * ответа на прежний, прочитал бы старое и затёр его. Пока запрос в пути,
 * добавления копятся и уходят одним пакетом после ответа. Страница
 * выгружается (pagehide) — ждать ответа некогда: запрос уходит сразу и несёт
 * и то, что ещё в пути (сервер объединяет, повтор безвреден). Отказ — «failed»,
 * телеметрия; несписанное ждёт «Повторить» или следующей правки.
 */
export function useAppendQueue(live: RefObject<AppendLive>) {
  const [status, setStatus] = useState<BackSyncStatus>('idle');
  const [lastAdded, setLastAdded] = useState<ConceptAppendBody | null>(null);
  const pending = useRef<CanvasConcept>(EMPTY_CANVAS);
  const flight = useRef<Flight | null>(null);
  const queued = useRef<{ leaving: boolean } | null>(null);
  const unloading = useRef(false);
  // До usePendingSave: его обработчик pagehide (досылка) срабатывает после этого и уже видит флаг.
  useEffect(() => {
    const on = (e: Event) => { unloading.current = e.type === 'pagehide'; };
    window.addEventListener('pagehide', on);
    window.addEventListener('pageshow', on);
    return () => { window.removeEventListener('pagehide', on); window.removeEventListener('pageshow', on); };
  }, []);

  function post(id: UserId, leaving: boolean): Promise<void> | undefined {
    const flying = flight.current;
    if (flying && !(leaving && unloading.current)) {
      queued.current = { leaving: leaving || Boolean(queued.current?.leaving) };
      return undefined;
    }
    const kept = unionCanvas(keepOnCanvas(pending.current, live.current.canvas), flying?.kept ?? EMPTY_CANVAS);
    pending.current = EMPTY_CANVAS;
    const body = appendBody(kept, live.current.concept);
    if (!body) return undefined;
    if (!leaving) setStatus('sending');
    const done: Promise<void> = (leaving ? api.appendConceptualization(id, body, { keepalive: true }) : api.appendConceptualization(id, body))
      .then((saved) => {
        live.current.onSaved(saved);
        announceConceptAppended({ clientId: id, concept: saved });
        setLastAdded(body);
        setStatus((st) => (st === 'sending' ? 'idle' : st));
        api.trackEvent('concept_sync_from_map'); // литералом — для трипваера analytics-sync; константа сверяется в useConceptSync.test
      })
      .catch((e: unknown) => {
        pending.current = unionCanvas(pending.current, kept);
        setStatus('failed');
        reportClientError({ message: `concept append from map failed${leaving ? ' on leave' : ''}: ${why(e)}`, section: SECTION });
      })
      .finally(() => {
        if (flight.current?.done === done) flight.current = null;
        const next = queued.current;
        queued.current = null;
        if (next) void post(id, next.leaving);
      });
    flight.current = { kept, done };
    return done;
  }

  const saver = usePendingSave<UserId, CanvasConcept>({
    delayMs: BACK_SYNC_DELAY_MS,
    send: (id, _all, { leaving }) => post(id, leaving), // накопленное — в pending, отказ ловит сам post
    onLeaveError: (e) => reportClientError({ message: `concept append on leave failed: ${why(e)}`, section: SECTION }),
  });

  const add = useCallback((id: UserId, added: CanvasConcept) => {
    pending.current = unionCanvas(pending.current, added);
    saver.schedule(id, pending.current);
  }, [saver]);
  const retry = useCallback((id: UserId) => {
    setStatus((s) => (s === 'failed' ? 'idle' : s));
    saver.schedule(id, pending.current);
    saver.flush();
  }, [saver]);
  const markToMap = useCallback(() => setLastAdded(null), []);

  return { status, lastAdded, add, retry, markToMap };
}
