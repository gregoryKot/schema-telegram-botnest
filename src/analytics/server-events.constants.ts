// Серверные события — пишет ТОЛЬКО бэкенд (guard, контроллер, крон), не клиент
// через POST /api/event. Отдельный файл — правило №10 (analytics.constants.ts).
//
//   auth_rejected — мини-апп пришёл с пустой подписью (meta.reason + meta.host).
//                   Пишется только guard'ом и всегда с userId = null — по этому
//                   признаку отчёт и отличает настоящие отказы от возможной
//                   подделки с клиента. Инцидент 2026-08-08: вход был сломан у
//                   всех пользователей Telegram, а отказ не считал никто.
//   client_error  — поломка фронтенда, meta.source + meta.section (бакет, см.
//                   client-error-section.ts). Пишет ClientErrorsController,
//                   userId = null; строка на source+section+ip за 5 мин, плюс
//                   числа meta.suppressed/unlogged (client-error-log-gate.ts).
//   signup_source — атрибуция посева, meta.src — слаг из SIGNUP_SOURCES. Пишет
//                   только бот в /start, когда payload — deep-link `src_<slug>`
//                   (parseSourceSlug, src/telegram/start-source.ts), один раз —
//                   при первом касании нового юзера (до гейта согласия: видна и
//                   конверсия в «принял соглашение»); повтор по ссылке не считается.
//   data_export   — выгрузка своих данных (152-ФЗ/GDPR, GET /api/account/export);
//                   meta.tables/meta.rows.
//   notify_queue_tick — итог прогона очереди уведомлений бота: только числа
//                   (telegram.schedule-queue.tally.ts); пишет крон, userId = null.
//   therapist_resigned — терапевт отказался от роли (TherapistExitService),
//                   meta.clientsEnded. С клиента meta не принимается (ветки в
//                   sanitizeMeta нет), /stats верит только строкам с числом.
//   therapy_invite — шаг воронки приглашения клиента терапевтом: создал код,
//                   клиент подключился, отозвал (meta.step + meta.kind, реестр
//                   и причины — therapy-invite-events.constants.ts). Пишет
//                   TherapyInviteService; ветки в sanitizeMeta нет.
//   crawler_visits — заходы роботов нейросетей за час (crawler-hits.ts): пишет
//                   только крон CrawlerHitsService, userId = null — /stats верит
//                   лишь таким строкам; sanitizeMeta — закрытые списки.
//   reminder_snoozed — «⏰ Напомню через час» под напоминанием: пишет только бот
//                   после постановки в очередь (src/telegram/telegram.snooze.ts),
//                   meta.quietShift — час попал в тихие часы. С клиента meta
//                   отбрасывается, /stats считает только строки с quietShift.
//   login_one_tap — вход через окно Google «Продолжить как…» (meta.outcome —
//                   login-one-tap.constants.ts): с 2026-11 не пишется (вход
//                   через Google убран), имя — ради истории /stats.
//   login_oauth   — вход через VK ID и Яндекс ID: login-oauth.constants.ts.
//   messenger_launch — сайт открыли в мессенджере и подпись сменилась на сессию
//                   (meta.host + meta.platform, launch-platforms.constants.ts):
//                   пишут ручки обмена telegram/webapp и max/webapp, userId = null
//                   (тот же приём, что у auth_rejected); с клиента meta не
//                   принимается. /stats — блок «Вход в мессенджере».
//   messenger_launch_failed — пара к нему: подпись НЕ сменилась на сессию
//                   (meta.host + meta.platform + meta.reason: expired|suspicious,
//                   src/auth/exchange-failure.report.ts). Пишут те же ручки,
//                   userId = null, строка на площадку+IP за 5 минут; с клиента
//                   meta не принимается.
//   ysq_data_deleted — «Удалить результаты теста» (DELETE /api/ysq-data): пишет
//                   YsqController после транзакции, meta.attempts — сколько
//                   пройденных попыток стёрто. С клиента meta не принимается,
//                   /stats («Удаление своих записей») считает строки с attempts.
export const SERVER_EVENTS = [
  'auth_rejected',
  'client_error',
  'signup_source',
  'data_export',
  'notify_queue_tick',
  'therapist_resigned',
  'therapy_invite',
  'crawler_visits',
  'reminder_snoozed',
  'login_one_tap',
  'login_oauth',
  'messenger_launch',
  'messenger_launch_failed',
  'ysq_data_deleted',
] as const;

// meta этих событий пишет только сервер: «Напомню через час» — бот, запуск в
// мессенджере и его отказ — ручки обмена подписи, стёртый тест схем — DELETE
// /api/ysq-data. sanitizeMeta отбрасывает их meta с клиента целиком, /stats
// считает только строки с meta — подделка через /api/event туда не попадает.
export const SERVER_META_EVENTS: ReadonlySet<string> = new Set([
  'messenger_launch',
  'messenger_launch_failed',
  'reminder_snoozed',
  'ysq_data_deleted',
]);
