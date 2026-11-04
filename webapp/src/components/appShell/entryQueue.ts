import { createContext, useContext } from 'react';
import type { ConsentState } from '../../hooks/useConsentGate';

// Очередь входов кабинета: один слой за раз (QA 2026-11, A-З7). Новичок видел
// сразу три слоя — автопоказ «Первый раз здесь», согласия и баннер куки, — а
// согласия звучали на «ты» до вопроса «ты/вы». Порядок как в мини-аппе
// (`shouldShowOnboarding` ждёт выбора формы): форма обращения → согласия →
// ссылка-приглашение → конец очереди, после которого открываются автопоказы.

/** Что показывать сейчас; `wait` — ждём ответа сервера, на экране ничего. */
export type EntryStep = 'address' | 'consent' | 'join' | 'wait' | 'done';

export function entryStep(s: {
  /** Вопрос о форме обращения решён: задан, отложен «Позже» или не нужен. */
  addressDone: boolean;
  consent: ConsentState;
  /** Параметр запуска разобран (useStartParam отработал). */
  linkHandled: boolean;
  /** Открыто согласие на присоединение по ссылке. */
  join: boolean;
}): EntryStep {
  if (!s.addressDone) return 'address';
  if (s.consent === 'checking') return 'wait';
  if (s.consent === 'needed') return 'consent';
  if (!s.linkHandled) return 'wait';
  return s.join ? 'join' : 'done';
}

/**
 * Очередь входов закончилась. Без провайдера — `true`: экран, отрисованный
 * вне AppShell (тесты, превью), ждать нечего.
 */
export const EntryFlowsDoneContext = createContext(true);

export function useEntryFlowsDone(): boolean {
  return useContext(EntryFlowsDoneContext);
}
