// Исход билета входа, когда ждать уже нечего (отказ, истечение, сорванный старт): текст один на
// все фронтенды, а рисует его экран сам (сайт — PaperAlert у кнопок входа, LoginProviderButtons).
// Без картинки-эмодзи (⌛, 🛑 до 2026-11): знак, если нужен, ставит экран. Текст безличный —
// экран входа показывается до того, как известна форма обращения.
import type { ReactNode } from 'react';
import type { LoginTicketState } from './useLoginTicket';

export type TicketFailureKind = Extract<
  LoginTicketState,
  { kind: 'denied' | 'expired' | 'failed' }
>['kind'];
export interface TicketFailure {
  kind: TicketFailureKind;
  text: string;
}

const TEXT: Record<TicketFailureKind, string> = {
  denied: 'Вход отклонён. Доступ никто не получил.',
  expired: 'Время кода вышло.',
  failed: 'Не получилось начать вход.',
};

/** Исход для состояния билета; пока вход идёт или ещё не начат — `null`. */
export function loginTicketFailure(
  state: LoginTicketState,
): TicketFailure | null {
  return state.kind === 'denied' ||
    state.kind === 'expired' ||
    state.kind === 'failed'
    ? { kind: state.kind, text: TEXT[state.kind] }
    : null;
}

/** Как фронтенд рисует исход; без него LoginTicketWait ставит строку и «Попробовать снова». */
export type TicketFailureView = (
  failure: TicketFailure,
  onRetry: () => void,
) => ReactNode;
