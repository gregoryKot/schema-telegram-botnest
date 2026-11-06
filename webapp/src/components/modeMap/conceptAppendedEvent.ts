import { useEffect, useRef } from 'react';
import type { ClientConceptualization, UserId } from '../../api';

// Холст «Графических карт» дописал в концептуализацию (#963). Вкладка
// «Концептуализация» того же клиента загружена один раз при открытии клиента
// и сохраняет тело целиком — без этого события первая же правка текста
// отправила бы старые modeIds/schemaIds/modeLinks и стёрла дописанное холстом.
// Событие окна, как modemap-* у холста: вкладки друг о друге не знают.
export const CONCEPT_APPENDED_EVENT = 'modemap-concept-appended';

export interface ConceptAppended { clientId: UserId; concept: ClientConceptualization }

export function announceConceptAppended(detail: ConceptAppended): void {
  window.dispatchEvent(new CustomEvent<ConceptAppended>(CONCEPT_APPENDED_EVENT, { detail }));
}

/** Подписка на дописанное холстом; обработчик берётся свежий, с состоянием текущего рендера. */
export function useConceptAppended(handler: (e: ConceptAppended) => void): void {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    const on = (e: Event) => ref.current((e as CustomEvent<ConceptAppended>).detail);
    window.addEventListener(CONCEPT_APPENDED_EVENT, on);
    return () => window.removeEventListener(CONCEPT_APPENDED_EVENT, on);
  }, []);
}
