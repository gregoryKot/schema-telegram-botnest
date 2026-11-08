// Форма сводки подтверждения merge — одна на всех потребителей: /account/merge
// (OAuth-редирект), экран привязки мессенджера и XHR-линковка из /account.
//
// twoFactorLost лежит РЯДОМ со счётчиками намеренно: второй фактор не
// переезжает (merge-user-rules.ts, totpSecret: skip), и раньше об этом молчали
// все три экрана (аудит 2026-07, M4). Флаг в одном объекте со counts —
// собрать подтверждение «забыв» про него нельзя.
export interface MergeSummary {
  /** Что записано в переносимом аккаунте: {'Rating': 12, …}. */
  counts: Record<string, number>;
  /** Сколько из них объединится с записями цели по ключу (R3). */
  combined: number;
  /** У источника 2FA включена, у цели — нет, значит защита пропадёт. */
  twoFactorLost: boolean;
}

/** Ответ линковки провайдера: либо привязали сразу, либо нужен merge. */
export type LinkProviderResult =
  | { ok: true }
  | {
      merge: true;
      mergeToken: string;
      summary: Record<string, number>;
      twoFactorLost: boolean;
    };
