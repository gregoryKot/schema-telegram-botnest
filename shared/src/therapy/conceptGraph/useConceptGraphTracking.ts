import { useCallback, useEffect, useRef } from 'react';

type Track = (name: string, meta?: Record<string, unknown>) => void;

/**
 * Аналитика графической концептуализации (правило №8), общая для обоих
 * фронтендов: `concept_graph_open` — один раз на монтирование графа,
 * `concept_mode_linked` — один раз на режим за монтирование, при первом
 * изменении его связи. Без меты: id клиента и текст связей в событие не
 * попадают (правило №7).
 *
 * Параметр назван `trackEvent`, а имена событий стоят литералами в вызовах —
 * так их видит трипваер src/security/analytics-sync.invariants.spec.ts
 * (он ищет вызовы trackEvent со строковым литералом), и опечатка в имени не превратится в метрику,
 * которая тихо не появится в /stats. Константы CONCEPT_GRAPH_OPEN_EVENT /
 * CONCEPT_MODE_LINKED_EVENT (shared/src/share/analytics.ts) сверяет с этими
 * литералами тест хука.
 */
export function useConceptGraphTracking(trackEvent: Track): {
  markLinked: (modeId: string) => void;
} {
  const opened = useRef(false);
  const linked = useRef(new Set<string>());

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    trackEvent('concept_graph_open');
  }, [trackEvent]);

  const markLinked = useCallback(
    (modeId: string) => {
      if (linked.current.has(modeId)) return;
      linked.current.add(modeId);
      trackEvent('concept_mode_linked');
    },
    [trackEvent],
  );

  return { markLinked };
}
