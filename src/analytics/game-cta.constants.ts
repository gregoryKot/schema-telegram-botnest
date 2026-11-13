// Куда ведёт кнопка финала игры (meta.to для game_cta_click), решение 2 в #1087:
//   app     — главная «попробовать в приложении» → schemehappens.ru/?from=game;
//   booking — вторая, тише: запись к терапевту (BOOKING_URL бота).
// Отправитель — game/src/therapyCta.ts, отчёт — блок «Игра» в /stats.
export const GAME_CTA_TARGETS = ['app', 'booking'] as const;
export type GameCtaTarget = (typeof GAME_CTA_TARGETS)[number];

const TARGET_SET: ReadonlySet<string> = new Set(GAME_CTA_TARGETS);

/** `{ to }` для известной цели, иначе `{}`: клик старой версии игры без `to`
 * не теряется, а просто не попадает в разбивку. */
export function ctaTargetMeta(meta: Record<string, unknown> | undefined): {
  to?: GameCtaTarget;
} {
  const to = meta?.to;
  return typeof to === 'string' && TARGET_SET.has(to)
    ? { to: to as GameCtaTarget }
    : {};
}
