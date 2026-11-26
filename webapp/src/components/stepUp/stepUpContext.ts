// Запрос с подтверждением кодом 2FA (S12, аудит 2026-11): одна механика на все
// ручки привязки и отвязки способов входа. Окно кода и повтор — StepUpProvider;
// разбор ответа и тексты — shared/src/auth/stepUp.ts.
import { createContext, useContext } from 'react';

/** Отправить запрос; `code` — код 2FA, когда сервер его попросил. */
export type StepUpSend = (code?: string) => Promise<Response>;
/** Ответ сервера; `null` — человек закрыл окно кода, действие отменено. */
export type StepUpFetch = (send: StepUpSend) => Promise<Response | null>;

/** `null` — провайдера сверху нет (тест компонента без него). */
export const StepUpContext = createContext<StepUpFetch | null>(null);

const passThrough: StepUpFetch = (send) => send();

/**
 * Без провайдера запрос уходит как раньше, а 403 «нужен код» достаётся
 * вызывающему обычной ошибкой. Провайдер стоит в RequireAuth и на /link.
 */
export function useStepUpFetch(): StepUpFetch {
  return useContext(StepUpContext) ?? passThrough;
}
