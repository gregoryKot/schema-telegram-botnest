import type { NotificationType } from './notification.service';

// Класс 20 «Канал есть не у каждого адресата» (docs/INCIDENTS.md, QA клиента
// 2026-11-03, #912): уведомление доходит только до того, у кого есть адрес —
// подписка на уведомления в приложении (src/push/) или вход через Telegram
// (выбор — src/bot/notify-channel.ts). У аккаунта сайта (Google, почта, MAX)
// без подписки очередь честно снимает уведомление «доставить некому»
// (telegram.schedule-queue.ts) — и если это было единственным следом того,
// что для человека сделал ДРУГОЙ (запрос терапевта), событие пропадает, а
// отправитель видит успех.
//
// Поэтому каждый тип классифицирован — исчерпывающе: Record<NotificationType>,
// новый тип без записи краснеет на tsc.
// - `self` — о самом человеке (напоминание, итог дня, серия). Экран честен
//   через notifyReachable (AccountService.isNotifyReachable →
//   shared/src/settings/notifyReach.ts): говорит, дойдёт ли сообщение.
// - `from_other` — от другого человека. Обязан оставлять след в данных,
//   видимый на сайте с любой площадки (`trace` — модель, `route` — ручка, по
//   которой адресат его видит), и спек (`spec`), что та же ручка, что ставит
//   уведомление, создаёт этот след. Сверку держит
//   notification-channels.spec.ts: спек существует, называет тип и ручку,
//   модель есть в schema.prisma.
export type NotificationChannel =
  | { readonly kind: 'self' }
  | {
      readonly kind: 'from_other';
      readonly trace: string;
      readonly route: string;
      readonly spec: string;
    };

const SELF = { kind: 'self' } as const;
const FROM_OTHER_SPEC = 'test/notify-from-other.e2e-spec.ts';
const THERAPIST_TASK = {
  kind: 'from_other',
  trace: 'UserTask',
  route: '/api/therapy/tasks',
  spec: FROM_OTHER_SPEC,
} as const;

export const NOTIFICATION_CHANNELS: Record<
  NotificationType,
  NotificationChannel
> = {
  reminder: SELF,
  pre_reminder: SELF,
  summary: SELF,
  comeback: SELF,
  welcome_back: SELF,
  onboarding_1: SELF,
  onboarding_3: SELF,
  onboarding_7: SELF,
  streak_7: SELF,
  streak_14: SELF,
  streak_30: SELF,
  lapsing_3: SELF,
  dormant_7: SELF,
  value_recap: SELF,
  reengagement_30: SELF,
  weekly: SELF,
  donate_reminder: SELF,
  anniversary_30: SELF,
  anniversary_60: SELF,
  anniversary_90: SELF,
  practice_reminder: SELF,
  practice_missed: SELF,
  low_streak_insight: SELF,
  nudge: SELF,
  security_notice: SELF, // способ входа, подбор кода 2FA (security-notice.service.ts)
  // Терапевт назначил задание / просит пройти тест — задание в «Сегодня».
  task_assigned: THERAPIST_TASK,
  ysq_requested: THERAPIST_TASK,
  // Напарник заполнил трекер — его оценки дня в карточке партнёра
  // (GET /api/pair: partnerTodayDone, partnerIndex).
  pair_activity: {
    kind: 'from_other',
    trace: 'Rating',
    route: '/api/pair',
    spec: FROM_OTHER_SPEC,
  },
};

/**
 * Хвост строки лога очереди про «некому доставить»: какие из снятых
 * уведомлений были от другого человека и где адресат увидит их след.
 * Пусто, если все снятые — о самом человеке.
 */
export function undeliveredFromOther(types: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const type of types) {
    const ch = NOTIFICATION_CHANNELS[type as NotificationType];
    if (ch?.kind !== 'from_other') continue;
    const key = `${type} → ${ch.trace} (${ch.route})`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return '';
  const list = [...counts].map(([k, n]) => `${k} ×${n}`).join(', ');
  return ` От другого человека, след на сайте есть: ${list}.`;
}
