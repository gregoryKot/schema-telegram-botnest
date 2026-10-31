// Серверные события — пишет ТОЛЬКО бэкенд (guard, контроллер, крон), не клиент
// через POST /api/event. Отдельный файл — правило №10 (analytics.constants.ts).
//
//   auth_rejected — мини-апп пришёл с пустой подписью (meta.reason + meta.host).
//                   Пишется только guard'ом и всегда с userId = null — по этому
//                   признаку отчёт и отличает настоящие отказы от возможной
//                   подделки с клиента. Инцидент 2026-08-08: вход был сломан у
//                   всех пользователей Telegram, а отказ не считал никто.
//   auth_success  — guard подтвердил вход по JWT, Telegram или MAX initData
//                   (meta.host: telegram|max|web). Пишется только guard'ом
//                   (src/api/auth-success.report.ts), всегда с userId = null
//                   (тот же приём, что у auth_rejected) и с троттлингом раз в
//                   5 минут на userId+площадку — это счётчик СЕССИЙ входа, не
//                   запросов. Пара к auth_rejected для блока «Вход в
//                   мессенджере»: падение входа не всегда выглядит ростом
//                   отказов, иногда клиент просто перестаёт доезжать до
//                   сервера — тогда виден провал именно этого счётчика.
//   client_error  — поломка фронтенда, meta.source + meta.section (бакет, см.
//                   client-error-section.ts). Пишет ClientErrorsController,
//                   userId = null; строка на source+section+ip за 5 мин, плюс
//                   числа meta.suppressed/unlogged (client-error-log-gate.ts).
//   signup_source — атрибуция посева, meta.src — слаг из SIGNUP_SOURCES. Пишет
//                   только бот в /start, когда payload — deep-link `src_<slug>`
//                   (parseSourceSlug, src/telegram/start-source.ts), и ровно
//                   один раз — при первом касании нового юзера (до гейта
//                   согласия, чтобы видеть и конверсию в «принял соглашение»).
//                   Возвращающийся по той же ссылке повторно не считается.
//   data_export   — выгрузка своих данных (152-ФЗ/GDPR, GET /api/account/export);
//                   meta.tables/meta.rows.
//   notify_queue_tick — итог прогона очереди уведомлений бота: только числа
//                   (telegram.schedule-queue.tally.ts); пишет крон, userId = null.
//   therapist_resigned — терапевт отказался от роли (TherapistExitService),
//                   meta.clientsEnded. С клиента meta не принимается (ветки в
//                   sanitizeMeta нет), /stats верит только строкам с числом.
export const SERVER_EVENTS = [
  'auth_rejected',
  'auth_success',
  'client_error',
  'signup_source',
  'data_export',
  'notify_queue_tick',
  'therapist_resigned',
] as const;
