// Форма сводки подтверждения merge — одна на всех потребителей:
// /account/merge (OAuth-редирект), экран привязки мессенджера и XHR-линковка
// из /account.
//
// twoFactorLost лежит РЯДОМ со счётчиками намеренно: второй фактор
// переносимого аккаунта не переезжает (merge-user-rules.ts, totpSecret:
// skip), и раньше об этом молчали все три экрана — человек с включённой 2FA
// терял её незаметно (аудит 2026-07, M4). Пока флаг в одном объекте со
// counts, собрать подтверждение «забыв» про него нельзя.
export interface MergeSummary {
  /** Сколько чего переедет: {'Rating': 12, …}. */
  counts: Record<string, number>;
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
