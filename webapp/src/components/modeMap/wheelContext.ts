import { createContext, useContext } from 'react';
import type { ConceptNeedLink } from '../../../../shared/src/therapy/conceptGraph/needLinks';

export type WheelSaveStatus = 'idle' | 'saving' | 'failed';

/** Колесо потребностей клиента для узла и панели холста: данные концептуализации и их запись. */
export interface WheelState {
  /** Колесо клиента; null — концептуализация ещё грузится или не загрузилась: править нечего. */
  links: ConceptNeedLink[] | null;
  /** Концептуализация не загрузилась (не «пусто»). */
  failed: boolean;
  status: WheelSaveStatus;
  /** На экране то, что подтвердил сервер; false — правка ещё в черновике (пауза, запрос или сбой). */
  saved: boolean;
  /**
   * Новое колесо целиком: видно сразу, на сервер уходит после паузы. `auto` — запись без действия
   * человека (перенос старых оценок из карты): в событие аналитики concept_needs_rated не идёт.
   */
  save: (links: ConceptNeedLink[], opts?: { auto?: boolean }) => void;
  retry: () => void;
}

export const WheelContext = createContext<WheelState | null>(null);

/** null — холст без клиента или вне редактора (панель в тесте): колесо только показывается пустым. */
export const useWheel = (): WheelState | null => useContext(WheelContext);
