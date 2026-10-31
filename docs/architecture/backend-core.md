# Карта: бэкенд — ядро, бот, контент, деньги

> Подробности к [docs/ARCHITECTURE.md](../ARCHITECTURE.md). Читай раздел нужного модуля
> (`grep -n '^### ' docs/architecture/backend-core.md`), а не весь файл. Карта врёт или
> молчит — исправь строку в том же PR и запиши промах в [docs/agent/NAV_LOG.md](../agent/NAV_LOG.md).

### Бутстрап (`src/main.ts`, `src/app.module.ts`)
- Порядок `main.ts`: `installBigIntJson()` → `registerUnhandledRejectionHandler` → `NestFactory.create(AppModule, {logger: AlertLogger, bodyParser: false})` → `trust proxy`=1 хоп (`src/infra/trust-proxy.ts`) + `clientIpSampler` → (только prod) 301 по `canonicalRedirectTarget` (`www.`/`schemalab.ru` → `schemehappens.ru`) и http→https по `x-forwarded-proto` → `cookieParser` → `helmet(helmetOptions())` → фильтры `GenericExceptionFilter` + `PrismaExceptionFilter` → `ValidationPipe({whitelist, transform})` → `installBodyParsers` (потолок 256 КБ, `src/infra/body-limit.ts`) → CORS (`ALLOWED_ORIGINS`; в prod по умолчанию только `https://schemehappens.ru`) → `listen(PORT||3000)`.
- После `listen`: `logCapabilityReport`, `logEnvCheck(checkEnv())`, `runClinicalLabelMigration` (фоном, старт не блокирует); SIGTERM/SIGINT → `app.close()`. Миграции БД — не в `src/main.ts`: контейнер запускает `node deploy/entrypoint.mjs` (`CMD` в `Dockerfile`), он поднимает заглушку на порту 3000, ждёт БД, выполняет `prisma/recover-p3009.sql` и `npx prisma migrate deploy` (3 попытки, при провале остаётся страница техработ) и только затем `node dist/main` на `APP_PORT`; `npm start` и `start:prod` в контейнере не используются.
- `AppModule`: `ConfigModule` (global), `ScheduleModule`, `ThrottlerModule` (хранилище через `PrismaService`), `CronLeaderModule` (`@Global`, аренда кронов `claimRun`); `APP_GUARD` = `UserThrottlerGuard`, `APP_INTERCEPTOR` = `AdminKeyAuditInterceptor`; провайдеры `DbOutageMonitorService`, `SelfCheckService`.
- Статика: один `ServeStaticModule` на webapp/dist (SPA-fallback `/*path`, `/api/{*path}` исключён, Cache-Control по `src/infra/static-cache.ts`). Сайт — `/`; `schema-miniapp/dist` (закоммичен) копируется в webapp/dist/app (→ `/app/`), game/dist — в webapp/dist/game (см. `Dockerfile`).
- `AppModule.configure()` (выполняется до ServeStatic), по порядку: `practiceDomainMiddleware` → `configureUnifiedFrontend` → подмена `index.html` на `GET /` для хоста-алиаса → `configureArticleSeo` (`/articles*`, `/sitemap.xml`).
- Хосты: `kotlarewski.ru`/`www.*` → 301 на `kotlarewski.gr` (визитка); визитка отдаёт только allow-list, остальное 301 на `schemehappens.ru` (детали — секция `src/*.ts`).
- Telegram-бот стартует не в `main.ts`, а в `TelegramService.onModuleInit` (long polling).

### `src/` — корневые файлы (middleware хостов)
Хост-стратегия: визитка `kotlarewski.gr` как узкая поверхность + увод мини-аппа `/app/*` в кабинет сайта.
- Входы: `src/practice-domain.middleware.ts` — редиректы хостов, allow-list визитки; `src/practice-domain.surface.ts` — `PRACTICE_PAGES`, `PRACTICE_API_PREFIXES`; `src/practice-domain.seo.ts` — robots.txt и sitemap.xml визитки, что в поиске — `PRACTICE_INDEXED_PAGES` (каждая страница классифицирована в `practice-domain.seo.spec.ts`); `src/practice-index-html.ts` — canonical/og:url под хост-алиас; `src/unified-frontend.middleware.ts` — `/app/*` → 302 `/today` за флагом; `src/unified-frontend.sw-stub.ts` — заглушка SW, снимает старый воркер мини-аппа.
- Связи: подключаются в `AppModule.configure`; `CANONICAL_HOST` из `src/infra/canonical-host.ts`; `PRACTICE_ALIAS_HOSTS` использует и `src/articles/article-seo.middleware.ts`; `PRACTICE_PAGES` — зеркало `personalRoutes` в `webapp/src/App.tsx` (сверяет спек).
- Подводные камни: страница/ручка API вне allow-list на `.gr` получает 301 на канон-хост, запись (POST/PUT/PATCH/DELETE) вне `PRACTICE_API_PREFIXES` не принимается вовсе, `/app*` и `/health` — исключения; новая страница визитки = строка в `PRACTICE_PAGES`. `UNIFIED_FRONTEND` (`1`/`true`) по умолчанию не задан: без него редирект `/app` не работает; флаг читать только через `isUnifiedFrontendOn()`.

### `src/bot/`
Не Telegram-бот, а доменный слой данных пользователя: потребности/трекер, дневники, тест схем (YSQ), упражнения, практики, пары, заметки, аккаунт, «Мой путь», пул фраз «Здорового Взрослого» и все метрики отчёта `/stats`.
- Входы: `src/bot/bot.module.ts` — `EXPORTED_PROVIDERS`, внутренние (суб-агрегаты и блоки `/stats`) — `INTERNAL_PROVIDERS` в `src/bot/bot.internal-providers.ts`, список отсортирован; `src/bot/bot.service.ts` — потребности (`NeedId`), оценки, настройки; `src/bot/account.service.ts` — `registerUser`, `canonicalUserId`, адресат уведомлений; `src/bot/user-data-tables.ts` — реестр user-таблиц, чеклист новой; `src/bot/stats-report.service.ts` — склейка `/stats` из `*-metrics.service.ts`.
- Связи: `BotModule` импортируют Telegram, Notification, Api, AccountApi, Therapy, Auth; `bot.client-overview.service.ts` нужен только `src/therapy`; `healthy-adult.*` обслуживают `src/channel`; таблицы: почти все с `userId` + `HealthyAdultPhrase`, `HealthyAdultPost`; удаление аккаунта — `account.delete.ts`.
- Подводные камни: хендлеров Telegraf здесь нет, они в `src/telegram`. Сырой `telegramId` в данные не совать: сначала `AccountService.canonicalUserId()` (после слияния аккаунтов данные лежат под веб-номером).
- Новый блок `/stats`: пара `X-metrics.service.ts` (запросы) + `X-metrics.format.ts` (текст), сервис в `INTERNAL_PROVIDERS` (`bot.internal-providers.ts`), в `StatsReportService` (список — `stats-report.blocks.ts`) и имя блока в раздел `STATS_SECTIONS` (`stats-sections.ts`, тест-сверка `stats-sections.spec.ts`); упавший блок заменяется заглушкой (`stats-settle.ts`).
- Блок «Разбор случая» (`case-metrics.*`): воронка (начали, сцена, вердикт, «у меня было иначе») — по событиям `AnalyticsEvent`; «сохранено разборов» — по `ModeDiaryEntry.fromCase` (маркер с миграции `20261027120000_mode_diary_from_case`; записи до неё — `false`). Две популяции с этапа 4 простого клиента (#877): «записано с сайта» — только сайт (мини-апп пишет `fromCase=false`; «Ровный день» с сайта тоже `fromCase` — итог разбора режимом Здорового Взрослого); «вердикт» и «назвали часть» — только мини-апп, на сайте этих шагов нет; `case_recognized{agreed}` с сайта = «не выбрал другой режим при сохранении», передумавшие без «Сохранить» в событие не попадают — порог «почти никто не спорит» читать с этой поправкой.

### `src/telegram/`
Telegram-бот на Telegraf (long polling): онбординг и согласие, диплинки `/start`, мини-тесты `/tests`, настройки уведомлений, админ-консоль, отправка напоминаний из очереди; заодно хостит публикацию в каналы.
- Входы: `src/telegram/telegram.service.ts` — `/start`, `/donate`, `/about`, согласие, snooze; `src/telegram/telegram.providers.ts` — Telegraf-инстанс, guard'ы (только private-чат, свежие апдейты); `src/telegram/telegram.schedule.service.ts` — крон очереди + полуночный планировщик; `src/telegram/telegram.admin.service.ts` — `/stats` `/zv` `/broadcast` `/zayavki` (ADMIN_ID); `src/telegram/telegram.constants.ts` — `BOT_COMMANDS`, `MINIAPP_URL`, `VALID_TIMEZONES`; `src/telegram/telegram.paced-sender.ts` — массовая отправка (очередь, `/broadcast` в `telegram.broadcast.ts`): пауза между сообщениями и ожидание `retry_after` на 429 (разбор — `telegram-rate-limit.ts`).
- Связи: импортирует Bot, Notification, Therapy, Analytics, Auth (билет входа); экспортирует `TelegramService`, `TelegramScheduleService`; `BookingModule` и `ApiModule` импортируют `TelegramModule`; в `providers` подключён `CHANNEL_PROVIDERS` из `src/channel`.
- Подводные камни: хендлеры `bot.command/action` регистрируются в `onModuleInit` каждого сервиса (`*.settings`, `*.quiz`, `*.login`, `*.link`, `*.notify-*`), а не в одном файле; polling запускает `TelegramService` через `BotLauncher` (`telegram.launch.ts`, ретрай при 409); ошибку апдейта мимо try/catch хендлера ловит `bot.catch` из `telegram.bot-catch.ts` (error владельцу, поллинг не рвётся); `BOT_REDIRECT_USERNAME` включает режим «бот переехал» вместо всех хендлеров.
- Диплинки `login_<КОД>` и `link_<КОД>` разбираются в `/start` до гейта согласия; `link_` переносит данные и уничтожает один из аккаунтов, поэтому у него отдельная ветка и карточка (`telegram.link.service.ts` против `telegram.login.service.ts`).

### `src/channel/`
Рассылка постов канала «Здоровый Взрослый» (два слота в день) на Telegram, VK, MAX, Threads, Pinterest; журнал доставки и досылка недошедшего.
- Входы: `src/channel/channel.providers.ts` — реестр площадок `TARGETS`; `src/channel/channel-publisher.service.ts` — одна фраза на все включённые площадки; `src/channel/channel-schedule.service.ts` — кроны окон 09–10/18–19 МСК, catch-up; `src/channel/channel-target.ts` — порт `ChannelTarget`, контракт адаптера; `src/channel/targets/` — адаптеры vk/max/threads/pinterest (Telegram: `src/telegram/telegram-channel.target.ts`).
- Связи: своего модуля нет, `CHANNEL_PROVIDERS` подключены в `TelegramModule` (нужен `TELEGRAF_BOT`); пул фраз и слоты — `HealthyAdultService` и `healthy-adult.schedule.ts` в `src/bot`; таблицы `HealthyAdultPhrase`, `HealthyAdultPost`, `ChannelDelivery`, `BookingSetting` (токен Threads, зашифрован); ручной запуск — `/zv` и `src/telegram/healthy-adult-admin.controller.ts` (`api/healthy-adult/admin`, `x-admin-key`).
- Подводные камни: площадка без своего env молчит (`destination()` = null) и попадает в отчёт как silent; новая площадка = адаптер + строка в `TARGETS`. Кроны `healthyAdultMorning/Evening/CatchUp` и `threadsTokenRefresh` идут под `claimRun`; пост выходит раз в окно в детерминированно-случайную минуту, частичный успех закрывает слот, упавшим площадкам досылает `retry-plan.ts`.

### `src/notification/`
Проактивные напоминания и вехи: очередь `ScheduledNotification`, дневной планировщик (максимум одно проактивное в день), адаптивная частота и паузы, тексты шаблонов.
- Входы: `src/notification/notification.planner.service.ts` — `planDay`: приоритеты и дневной бюджет; `src/notification/notification.service.ts` — очередь, `NotificationType`, `PROACTIVE_TYPES`; `src/notification/notification.cadence.service.ts` — адаптивная частота, пауза, счётчик игнора; `src/notification/notification.templates.ts` — тексты (плюс `.soft`, `.activity`, `template-data`); `src/notification/notification.time.ts` — таймзоны, тихие часы. Кнопки под уведомлениями (⏸ Пауза, отложить) — `src/notification/notification.buttons.ts`, их обработчики (`notify:*`) — `src/telegram/telegram.notify-actions.service.ts`.
- Связи: импортирует `BotModule`; используют `TelegramModule` (`TelegramScheduleService`), `ApiModule`; таблица `ScheduledNotification` + поля `User.notify*`; форма «ты/вы» — `address-form.ts` (её же берёт `src/quiz`).
- Подводные камни: модуль сам не отправляет и крон не держит: отправка и кроны в `src/telegram/telegram.schedule.service.ts` (`processQueue` `*/5` под `claimRun('notificationQueue')`, полночный планировщик `0 0 * * *` UTC под `midnightPlanner`). Новый тип: `NotificationType` + `PROACTIVE_TYPES` (бюджет, отмена при паузе) или `QUIET_EXEMPT_TYPES` + шаблон.
- `payload` шифруется целиком (`notification-payload.crypto.ts`) и расшифровывается только в `getDue`, поэтому SQL по полям payload невозможен.

### `src/analytics/`
Продуктовые события (`AnalyticsEvent`) для метрик `/stats`: allow-list имён, запись, ретеншен 90 дней.
- Входы: `src/analytics/analytics.constants.ts` — `ANALYTICS_EVENTS`, `PUBLIC_ANALYTICS_EVENTS`; `src/analytics/analytics.service.ts` — `track()` (не бросает) + `pruneOld`; `src/analytics/server-events.constants.ts` — события только от бэкенда; `src/analytics/anonymous-events.constants.ts` — события без `userId` (кризисные).
- Связи: `AnalyticsModule` импортируют Telegram, Api, AccountApi, Therapy, Auth; HTTP-приём в `src/api`: `analytics.controller.ts` (`POST /api/event`, с входом) и `public-events.controller.ts` (`POST /api/public-event`, аноним); санитайзеры `src/api/analytics-meta.sanitize*.ts`; читают `src/bot/*-metrics.service.ts`.
- Подводные камни: новое событие = имя в `ANALYTICS_EVENTS` (или файл-подсписок `*.constants.ts`) + `sanitizeMeta` в `src/api/analytics-meta.sanitize*.ts` + то же имя на фронтах; `meta` только структурный non-PII, свободный текст нельзя (не шифруется).
- Неизвестное имя в `track()` молча игнорируется; `crisis_*` пишутся с `userId=null` (`eventOwnerId`); `pruneOld` (04:00) без `claimRun` осознанно (`exempt` в `scripts/cron-leader-baseline.json`).

### `src/articles/`
Блог сайта: публичное чтение, админ-CRUD, серверная подстановка SEO для краулеров и `sitemap.xml` из БД.
- Входы: `src/articles/articles.service.ts` — CRUD + сид встроенных статей на старте; `src/articles/articles.seed.ts` — тексты встроенных статей; `src/articles/article-seo.middleware.ts` — title/OG/JSON-LD/текст в `index.html`; `src/articles/article-seo.routes.ts` — регистрация middleware (вызов из `AppModule`); `src/articles/sitemap.middleware.ts` — `sitemap.xml` из БД.
- Связи: `ArticlesModule` в `AppModule`; контроллеры `api/articles` и `api/articles/admin` (`x-admin-key`, `ADMIN_BOOKING_KEY`); читает webapp/dist/index.html; таблицы `Article`, `BookingSetting` (ключ `articlesSeedVersion`); SVG-диаграммы живут на фронте (`webapp/src/pages/articleDiagrams.ts`), в БД только `diagramKey`.
- Подводные камни: тексты встроенных статей обновляются на старте только после повышения `SEED_VERSION` в `articles.service.ts`; `heroImage` и статьи, созданные админом, сид не трогает. SEO и sitemap — Express-middleware на путях без `/api`; хост `kotlarewski.gr` сюда не доходит (свой sitemap в `practice-domain.middleware.ts`).

### `src/quiz/`
Контент и подсчёт публичных мини-тестов без регистрации (`drives`, `critic`, `voice`, `battery`) для бота и сайта.
- Входы: `src/quiz/quiz-registry.ts` — `QUIZ_IDS`, `buildQuizzes(form)`, `getQuiz`; `src/quiz/quiz-logic.ts` — `computeQuizResult`: большинство голосов; `src/quiz/quiz.types.ts` — типы `Quiz`, `QuizQuestion`, `QuizOption`; `src/quiz/quiz-*.data.ts` — вопросы и результаты четырёх тестов.
- Связи: модуля и таблиц нет, чистые функции; используют `src/telegram/telegram.quiz.service.ts` (`/tests`, `qz:*`), `src/api/quiz.controller.ts` (`GET /api/quizzes`), `src/api/public-events.controller.ts` (проверка id результатов); события `quiz_started`/`quiz_completed`.
- Подводные камни: контент строится от формы «ты/вы» через `t(form, …)` из `notification/address-form.ts`; цитаты-реплики не разводятся. `quiz-logic.ts` — зеркало `shared/src/quiz/quizEngine.ts` (бэкенд не импортирует `shared`, rootDir=src), паритет держат `quiz-logic.spec.ts` и `webapp/src/hooks/useQuizRunner.test.ts`.

### `src/site-content/`
Редактируемые из админки блоки лендинга: фото героя и темы бегущей строки.
- Входы: `src/site-content/site-content.service.ts` — чтение/запись, дефолты marquee; `src/site-content/site-content-admin.controller.ts` — `PATCH hero-photo`/`marquee`, `x-admin-key`; `src/site-content/site-content.controller.ts` — публичный `GET /api/site-content`; `src/site-content/site-content-admin.dto.ts` — валидация тел.
- Связи: `SiteContentModule` в `AppModule`; таблица `BookingSetting` (ключи `heroPhoto`, `marqueeTopicsA`, `marqueeTopicsB`); фронт админки `webapp/src/pages/admin/PhotoSection.tsx`.
- Подводные камни: `MAX_PHOTO_BYTES` (220 КБ) — самое длинное законное тело запроса и основа потолка парсера `BODY_LIMIT` (`src/infra/body-limit.ts`); спек сверяет. Фото принимается только как data-URI png/jpeg/webp, SVG отвергается.

### `src/account/`
Выгрузка «всех моих данных» (право на переносимость, 152-ФЗ/GDPR); пара к удалению аккаунта `src/bot/account.delete.ts`.
- Входы: `src/account/data-export.service.ts` — сбор выгрузки по `userId`; `src/account/export-policy.ts` — реестр: отдаём или withhold по моделям; `src/account/export-policy.client.ts` — то же для моделей с `clientId`; `src/account/data-export.client-side.ts` — данные о человеке на стороне терапевта; `src/account/export-decrypt.ts` — расшифровка, нечитаемое в `_unreadableFields`.
- Связи: `DataExportService` регистрирует `src/api/account-api.module.ts`; эндпоинт `GET /api/account/export` (`TelegramAuthGuard`, 1/мин, 5/сутки); контур таблиц — `src/bot/user-data-tables.ts`, параллельно `src/auth/merge.service.ts`.
- Подводные камни: каждая модель с `userId` или `clientId` обязана быть классифицирована в `export-policy*.ts`, иначе падает гейт-спек; enc-поля сверяются с `FIELD_POLICY` (`src/utils/encryption-policy.ts`). Кнопки выгрузки в UI пока нет (долг в `scripts/feature-parity-baseline.json`).

### `src/donation/`
Разовые донаты через Robokassa (страница `/donate`, источник `app`|`game`).
- Входы: `src/donation/donation.service.ts` — `create` (pending + ссылка), `markPaidByInvId`; `src/donation/donation.controller.ts` — `POST /api/donation`, honeypot `website`, throttle; `src/donation/donation.dto.ts` — `DonateDto`.
- Связи: своего модуля нет: контроллер и сервис в `BOOKING_CONTROLLERS`/`BOOKING_PROVIDERS` (`src/booking/booking.registry.ts`, `BookingModule`); `RobokassaService`, `BookingNotifyService` из `src/booking`; общий вебхук — `src/booking/payment.controller.ts`; таблица `Donation` (`email`, `comment` шифруются).
- Подводные камни: один ResultURL на три потока, разводит диапазон InvId: брони = `booking.id`, донаты [1e9, 2e9) (`DONATION_INVID_BASE`), подписки ≥ 2e9. Сумма 10–100 000 ₽; в проде без Robokassa отказ до INSERT (`assertPaymentAvailable`).

### `src/subscription/`
Платные подписки (месяц/год) с рекуррентными списаниями Robokassa; включаются только при `SUBSCRIPTION_ENABLED=true`.
- Входы: `src/subscription/subscription.service.ts` — `subscribe`/`cancel`, обёртка над кроном; `src/subscription/subscription.charges.ts` — `markChargePaid` и почасовой `chargeDue`; `src/subscription/subscription.charge-activate.ts` — транзакция активации (CAS по статусу charge); `src/subscription/subscription.charge-failed.ts` — транзакция сбоя списания; `src/subscription/subscription.controller.ts` — `/api/subscription` (`options`, `by-token`, `cancel/:token`).
- Связи: своего модуля нет: провайдер и экспорт в `BookingModule`, контроллер в `booking.registry.ts`; вебхук — `src/booking/payment.controller.ts`; таблицы `Subscription`, `SubscriptionCharge`, `BookingSetting` (цена `sub:<period>`).
- Подводные камни: `@Cron('0 * * * *')` `chargeDue` без `claimRun`: защита от дубля — атомарный `UPDATE nextChargeAt` до обращения в Robokassa (при падении платёж пропускается, а не списывается дважды) и проверка pending-charge за 48 ч; за прогон не более 50 подписок.
- Оплата не оживляет отменённую подписку (предикат статуса в `charge-activate.ts`): деньги засчитываются за charge, владельцу уходит сигнал из `subscription-paid-after-cancel.ts`.

### `src/logger/`
`AlertLogger`: ошибки приложения превращаются в сообщение админу (Telegram, фолбэк e-mail) с троттлингом; авария БД сворачивается в одно сообщение.
- Входы: `src/logger/alert.logger.ts` — `AlertLogger.error()` → `notifyAdminWithFallback`; `src/logger/db-outage.ts` — классификация «БД недоступна», один DM + recovery.
- Связи: ставится в `main.ts` (`NestFactory.create({logger})`); доставка — `src/utils/admin-alert.ts`, `src/utils/alert-throttle.ts`; `isConnectionError` использует `telegram.schedule.service.ts`.
- Подводные камни: алерт шлёт только `logger.error`; для временных сбоев (в том числе соединения с БД) использовать `warn`. Троттлинг по тексту сообщения (цифры/uuid заменяются плейсхолдером) раз в 60 с плюс общий потолок 15 алертов за 60 с: текст `error` делать стабильным, без переменных частей.

### `src/types/`
Единственный файл `src/types/express.d.ts`: глобальное расширение `express.Request` полями, которые ставят гварды.
- Входы: `src/types/express.d.ts` — `webUser?: {userId: bigint}`, `telegramUserId?`, `telegramFirstName?`.
- Связи: поля выставляют `JwtAuthGuard`/`OptionalJwtGuard`/`TelegramAuthGuard` (`src/auth`, `src/api`); контроллеры читают через `uid(req)` (`src/api/request-utils.ts`).
- Подводные камни: `telegramUserId` — `Number` (выше 2^53 округляется), для поиска пользователя не использовать; брать `uid(req)` / `webUser.userId` (bigint). Поля опциональны: на публичных эндпоинтах гвард их не ставит.
