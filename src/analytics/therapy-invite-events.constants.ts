// Воронка приглашения клиента терапевтом (правило №8): «создал код → клиент
// подключился → терапевт отозвал». Отдельный файл — analytics.constants.ts
// заморожен в храповике размера (правило №10); в ANALYTICS_EVENTS имя
// попадает через SERVER_EVENTS (server-events.constants.ts).
//   therapy_invite — СЕРВЕРНОЕ событие (TherapyInviteService и сверка
//               карточки), не клиент. Ветки в sanitizeMeta нет намеренно:
//               meta с POST /api/event отбрасывается, а /stats считает только
//               строки с полями из списков ниже (тот же приём, что у
//               therapist_resigned). userId — кто действовал: терапевт у
//               created/revoked/confirmed/denied, клиент у joined.
//               kind 'new' — обычное приглашение, 'offline' — из карточки
//               офлайн-клиента: её записи переезжают на аккаунт, когда
//               терапевт подтвердит, что код ввёл тот же человек (confirmed;
//               denied — «нет», src/therapy/therapy-invite-card-claim.ts).
//               Блок в /stats — src/bot/therapy-invite-metrics.format.ts.
export const THERAPY_INVITE_EVENT = 'therapy_invite';

export const THERAPY_INVITE_STEPS = [
  'created',
  'joined',
  'revoked',
  'confirmed',
  'denied',
] as const;
export type TherapyInviteStep = (typeof THERAPY_INVITE_STEPS)[number];

export const THERAPY_INVITE_KINDS = ['new', 'offline'] as const;
export type TherapyInviteKind = (typeof THERAPY_INVITE_KINDS)[number];
