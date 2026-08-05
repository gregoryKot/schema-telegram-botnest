// Типы шага привязки — отдельным файлом, чтобы сервис и контроллер не тянули
// друг друга ради одной формы ответа.
import type { TokenPair } from './auth.service';

/** Что покажет браузер до подтверждения: чей аккаунт и что переедет. */
export interface LinkPreview {
  provider: string;
  /** Имя из профиля мессенджера. Null, если площадка его не прислала. */
  displayName: string | null;
  /** Браузер вошёл под тем же аккаунтом — переносить нечего. */
  sameAccount: boolean;
  /** Сколько чего переедет: {'Оценки': 12, …}. Пусто при sameAccount. */
  summary: Record<string, number>;
}

export type DeviceLinkStatus =
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'linked'; tokens: TokenPair };
