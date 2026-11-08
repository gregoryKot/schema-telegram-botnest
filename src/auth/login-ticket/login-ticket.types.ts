// Типы билета входа — отдельным файлом, чтобы сервис, контроллер и бот не
// тянули друг друга ради одной формы ответа.
import type { TokenPair } from '../auth.service';

/**
 * Зачем выписан билет.
 *
 * `login` — у контейнера сессии НЕТ и хозяина у билета тоже: человек входит с
 * ярлыка или из чистой вкладки. `link` — сессия есть, человек привязывает к
 * ней аккаунт другой площадки (прежний device-link). `handoff` — сессия есть
 * (сайт внутри Telegram/MAX), билет выписан сразу подтверждённым, чтобы
 * внешний браузер забрал ту же сессию опросом; короткий код никому не
 * показывается, в воронку входа (`LoginTicketReport`) билет не попадает.
 */
export type TicketIntent = 'login' | 'link' | 'handoff';

/** Что показать человеку до подтверждения: чей аккаунт и что переедет. */
export interface LinkPreview {
  provider: string;
  /** Имя из профиля мессенджера. Null, если площадка его не прислала. */
  displayName: string | null;
  /** Подтверждающий вошёл под тем же аккаунтом — переносить нечего. */
  sameAccount: boolean;
  /** Сколько чего переедет: {'Оценки': 12, …}. Пусто при sameAccount. */
  summary: Record<string, number>;
  /** Сколько записей сольётся с записями этого аккаунта, а не переедет рядом
   * (merge-combine.ts). 0 при sameAccount. Экран привязки называет число. */
  combined: number;
  /** Второй фактор переносимого аккаунта не переедет (merge-user-rules.ts,
   * totpSecret: skip). Этот поток тоже зовёт merge.merge(), поэтому говорим
   * это вслух и здесь, не только на /account/merge. Пусто при sameAccount. */
  twoFactorLost: boolean;
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
