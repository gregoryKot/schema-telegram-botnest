import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, reportClientError, type UserId } from '../../api';
import { usePendingSave } from '../../../../shared/src/utils/usePendingSave';
import type { ConceptNeedLink } from '../../../../shared/src/therapy/conceptGraph/needLinks';
import { announceConceptAppended } from './conceptAppendedEvent';
import { useConceptSyncState } from './conceptSyncContext';
import { WheelContext, type WheelSaveStatus, type WheelState } from './wheelContext';

/** Пауза перед записью колеса: протяжка ползунка и набор текста уходят одним запросом. */
export const WHEEL_SAVE_DELAY_MS = 700;
const why = (e: unknown) => (e instanceof Error ? e.message : 'unknown');

/**
 * Колесо потребностей клиента на холсте. Источник — концептуализация
 * (ClientConceptualization.needLinks): одно колесо на клиента, сколько бы карт у
 * него ни было, и то же колесо показывает вид «Схема». Правка видна сразу
 * (черновик поверх загруженного), на сервер уходит колесо целиком после паузы;
 * ответ заменяет концептуализацию холста. Сбой не теряет правку: черновик
 * остаётся на экране, «Повторить» шлёт его снова.
 */
export function WheelProvider({ clientId, children }: { clientId: UserId | null | undefined; children: ReactNode }) {
  const sync = useConceptSyncState();
  const concept = sync?.concept ?? null;
  const loaded = concept && concept !== 'failed' ? (concept.needLinks ?? []) : null;
  const [draft, setDraft] = useState<{ id: UserId; links: ConceptNeedLink[] } | null>(null);
  const [status, setStatus] = useState<WheelSaveStatus>('idle');
  const latest = useRef<ConceptNeedLink[] | null>(null);
  // Событие concept_needs_rated (правило №8): одно на открытие холста, после первого сохранения с правкой
  // человека. byHuman — в несохранённом колесе такая правка есть, а не один автоперенос (useWheelLegacyMove).
  const tracked = useRef(false);
  const byHuman = useRef(false);
  const replaceConcept = sync?.replaceConcept;

  const saver = usePendingSave<UserId, ConceptNeedLink[]>({
    delayMs: WHEEL_SAVE_DELAY_MS,
    send: (id, links, { leaving }) => {
      // Признак берётся при отправке и живёт до ответа: правка, сделанная пока идёт запрос, ждёт своего.
      const human = byHuman.current;
      byHuman.current = false;
      const rated = () => {
        if (!human || tracked.current) return;
        tracked.current = true;
        api.trackEvent('concept_needs_rated'); // литералом — для трипваера analytics-sync; константа сверяется в WheelProvider.test
      };
      if (leaving) return api.saveConceptNeeds(id, links, { keepalive: true }).then(rated);
      setStatus('saving');
      return api.saveConceptNeeds(id, links)
        .then((saved) => {
          announceConceptAppended({ clientId: id, concept: saved });
          // Пока шёл запрос, колесо правили дальше — экран ждёт следующего ответа; сохранение уже состоялось.
          if (latest.current === links) { replaceConcept?.(saved); setDraft(null); setStatus('idle'); }
          rated();
        })
        .catch((e: unknown) => {
          if (human) byHuman.current = true; // «Повторить» дошлёт ту же правку — событие уйдёт с ней
          setStatus('failed');
          reportClientError({ message: `needs wheel save failed: ${why(e)}`, section: 'therapist.modeMap' });
        });
    },
    onLeaveError: (e) => reportClientError({ message: `needs wheel save on leave failed: ${why(e)}`, section: 'therapist.modeMap' }),
  });

  const save = useCallback((links: ConceptNeedLink[], opts?: { auto?: boolean }) => {
    if (clientId == null) return;
    latest.current = links;
    setDraft({ id: clientId, links });
    saver.schedule(clientId, links);
    // После schedule: он сначала досылает ожидавшее колесо прежнего клиента — со своим признаком.
    if (!opts?.auto) byHuman.current = true;
  }, [clientId, saver]);
  const retry = useCallback(() => {
    if (clientId == null || !latest.current) return;
    saver.schedule(clientId, latest.current);
    saver.flush();
  }, [clientId, saver]);

  const mine = draft && draft.id === clientId ? draft.links : null;
  const links = mine ?? loaded;
  const value = useMemo<WheelState>(
    () => ({ links, failed: concept === 'failed', status, saved: !mine, save, retry }),
    [links, concept, status, mine, save, retry],
  );
  return <WheelContext.Provider value={value}>{children}</WheelContext.Provider>;
}
