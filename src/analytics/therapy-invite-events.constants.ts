// Воронка приглашения клиента терапевтом (правило №8): «создал код → клиент
// подключился → терапевт отозвал». До этого ни один шаг событием не был
// (docs/open/therapy.md, «Воронка … не считается»): сколько кодов доходят до
// клиента, не видел никто. Отдельный файл — analytics.constants.ts заморожен
// в храповике размера (правило №10); в ANALYTICS_EVENTS имя попадает через
// SERVER_EVENTS (server-events.constants.ts).
//
//   therapy_invite — СЕРВЕРНОЕ событие: пишет TherapyInviteService
//               (src/therapy/therapy-invite.service.ts), не клиент. Ветки в
//               sanitizeMeta нет намеренно: meta с POST /api/event
//               отбрасывается, а /stats считает только строки с полями из
//               списков ниже — подделка с клиента в отчёт не попадает (тот же
//               приём, что у therapist_resigned). userId — кто действовал:
//               терапевт у created/revoked, клиент у joined.
//               meta { step: THERAPY_INVITE_STEPS, kind: THERAPY_INVITE_KINDS }:
//               kind 'new' — обычное приглашение («Новый клиент», «Ссылка»),
//               'offline' — из карточки офлайн-клиента: при подключении
//               задания, заметки, карты и концептуализация карточки
//               переезжают на аккаунт (therapy-invite-attach.ts).
//               Блок в /stats — «Приглашения клиентов»
//               (src/bot/therapy-invite-metrics.format.ts).
export const THERAPY_INVITE_EVENT = 'therapy_invite';

export const THERAPY_INVITE_STEPS = ['created', 'joined', 'revoked'] as const;
export type TherapyInviteStep = (typeof THERAPY_INVITE_STEPS)[number];

export const THERAPY_INVITE_KINDS = ['new', 'offline'] as const;
export type TherapyInviteKind = (typeof THERAPY_INVITE_KINDS)[number];
