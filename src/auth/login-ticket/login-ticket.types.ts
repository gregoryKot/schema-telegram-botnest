// Типы билета входа — отдельным файлом, чтобы сервис, контроллер и бот не
// тянули друг друга ради одной формы ответа.
import type { TokenPair } from '../auth.service';

/**
 * Зачем выписан билет.
 *
 * `login` — у контейнера сессии НЕТ и хозяина у билета тоже: человек входит с
 * ярлыка или из чистой вкладки. `link` — сессия есть, человек привязывает к
 * ней аккаунт другой площадки (прежний device-link).
 */
export type TicketIntent = 'login' | 'link';

/** Что показать человеку до подтверждения: чей аккаунт и что переедет. */
export interface LinkPreview {
  provider: string;
  /** Имя из профиля мессенджера. Null, если площадка его не прислала. */
  displayName: string | null;
  /** Подтверждающий вошёл под тем же аккаунтом — переносить нечего. */
  sameAccount: boolean;
  /** Сколько чего переедет: {'Оценки': 12, …}. Пусто при sameAccount. */
  summary: Record<string, number>;
}

/**
 * Ответ опроса.
 *
 * `denied` отделён от `expired` намеренно: «человек сказал, что это не он» и
 * «время вышло» — разные новости, и экран обязан говорить разное. Слить их в
 * одно значило бы показать «попробуйте ещё раз» тому, кого только что
 * попытались обмануть.
 */
export type TicketStatus =
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'linked'; tokens: TokenPair };

/** Строка билета в том виде, в каком её показывает бот при сверке. */
export interface TicketForConfirm {
  userCode: string;
  intent: TicketIntent;
  deviceLabel: string;
  hostId: string;
}
