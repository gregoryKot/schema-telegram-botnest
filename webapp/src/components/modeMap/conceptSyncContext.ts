import { createContext, useContext } from 'react';
import type { ConceptAppendBody } from '../../../../shared/src/therapy/conceptAppend';
import type { ClientConceptState } from './clientConceptContext';
import type { ConceptMissing, ConceptResponse } from './conceptSync';

/** Запись с холста в поля: idle — нечего писать или записано; failed — ждёт «Повторить» или следующей правки. */
export type BackSyncStatus = 'idle' | 'sending' | 'failed';

/** Связь холста с концептуализацией (#963) — для строки над холстом и пункта «Из концептуализации клиента». */
export interface ConceptSyncState {
  /** Есть клиент: личная карта без клиента ни с чем не связана. */
  active: boolean;
  /** Карта пары в поля не пишет: режимы на ней двух людей. */
  couple: boolean;
  concept: ClientConceptState;
  /** null — концептуализация ещё не пришла или не загрузилась. */
  missing: ConceptMissing | null;
  status: BackSyncStatus;
  /** Последняя запись с холста; гаснет после «Добавить на карту». */
  lastAdded: ConceptAppendBody | null;
  retry: () => void;
  markToMap: () => void;
  /** Свежая концептуализация с сервера заменяет загруженную при открытии карты. */
  replaceConcept: (c: ConceptResponse) => void;
}

export const ConceptSyncContext = createContext<ConceptSyncState | null>(null);

export const useConceptSyncState = (): ConceptSyncState | null => useContext(ConceptSyncContext);
