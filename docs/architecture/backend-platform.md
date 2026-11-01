# Карта: бэкенд — вход, API, безопасность, терапия, запись, инфраструктура

> Подробности к [docs/ARCHITECTURE.md](../ARCHITECTURE.md). Читай раздел нужного модуля
> (`grep -n '^### ' docs/architecture/backend-platform.md`), а не весь файл. Карта врёт или
> молчит — исправь строку в том же PR и запиши промах в [docs/agent/NAV_LOG.md](../agent/NAV_LOG.md).

### `src/auth/`
Идентификация и сессии: вход (Telegram, Google, VK, MAX, e-mail), JWT + refresh, 2FA (TOTP), билеты входа, привязка/слияние аккаунтов.
- Входы:
  - `src/auth/auth.service.ts` — токены, findOrCreateUserByProvider (refresh-логика вынесена в `refresh-*.ts`)
  - `src/auth/auth-flow.service.ts` — signInOrLinkOrMerge: единый исход любого входа
  - `src/auth/jwt.guard.ts` — JwtAuthGuard и OptionalJwtGuard
  - `src/auth/merge.service.ts` — слияние аккаунтов: перенос данных source→target
  - `src/auth/providers/registry.ts` — реестр провайдеров; новый способ входа — сюда
- Связи: Prisma (User, AuthProvider, WebSession, EmailToken, LoginTicket), analytics, `src/utils/crypto.ts` (PII провайдеров), `src/infra/cron-leader.service.ts` (watchdog домена бота); экспорты AuthModule (AuthService, JwtAuthGuard, SecurityLogService, TotpService, MaxProvider, LoginTicketService, TicketLinkService) используют api/, booking/, therapy/, telegram/.
- Подводные камни:
  - userId Telegram-пользователя = telegramId; веб-аккаунты (Google/VK/MAX/почта) получают id из [1e15, 9e15) (`src/auth/user-id-range.ts`, `isWebUserId`) — писать в Telegram-чат по такому id нельзя.
  - Слияние переносит таблицы из `USER_OWNED_TABLES` (`src/auth/user-owned-tables.ts`, правится с каждой новой user-таблицей, сверяется спеком); WebSession/EmailToken/LoginTicket при слиянии удаляются, 2FA исходного аккаунта не переезжает.
  - Merge и привязка почты требуют доказательства личности через `CallerIdentityService` (`src/auth/caller-identity.ts`: Bearer-JWT ИЛИ живая refresh-кука); link-токен — только httpOnly-кука `link_token` (`?link_token=` убран). Refresh-кука: `path=/api/auth`, SameSite=strict, для iframe (MAX, Telegram Web) — None (`src/auth/auth-http.util.ts`).
- Потоки входа:
  - Mini-app Telegram: заголовок `x-telegram-init-data` → `TelegramAuthGuard` (`src/api/telegram-auth.guard.ts`, тело — `src/api/init-data-paths.ts`), подпись проверяет единый `src/auth/telegram-init-data.ts`; обмен на JWT-сессию — POST `/api/auth/telegram/webapp` (`src/auth/auth-account.controller.ts`). MAX mini-app: `x-max-init-data` (`src/auth/max-init-data.ts`, `src/auth/providers/max.provider.ts`, токен `MAX_BOT_TOKEN`), POST `/api/auth/max/webapp` (`src/auth/auth-max.controller.ts`).
  - Сайт, Telegram Login Widget: POST `/api/auth/telegram/widget` и GET `telegram/redirect` в `src/auth/auth-telegram.controller.ts`, проверка — `src/auth/providers/telegram.provider.ts` (окно подписи 15 мин); access-JWT приходит в теле ответа, refresh — в httpOnly-куке.
  - Сайт, Google/VK OAuth: `src/auth/auth-oauth.controller.ts` (GET `google`, `vk` + `/callback`) → `AuthFlowService.oauthRedirect/oauthCallback`, `src/auth/providers/google.provider.ts`, `src/auth/providers/vk.provider.ts` (PKCE, `src/auth/providers/vk-state.ts`), `state` подписан (`src/auth/oauth-state.ts`); Google One Tap — `src/auth/auth-one-tap.controller.ts` + `src/auth/google-one-tap.service.ts`. E-mail magic link — `src/auth/magic-link.ts`, `src/auth/email-token.service.ts`; билет входа (PWA ↔ браузер/бот) — `src/auth/login-ticket/`, `src/auth/auth-ticket.controller.ts`, `src/auth/auth-login-confirm.controller.ts`.
  - Слияние: при конфликте providerId `signInOrLinkOrMerge` отдаёт подписанный mergeToken → POST `/api/auth/merge` (`src/auth/auth-account.controller.ts`; OptionalJwtGuard + CallerIdentityService + TOTP источника) → `src/auth/merge.service.ts`.
  - Личность запроса: `JwtAuthGuard` (Bearer access-JWT 15 мин, проверяет что User жив), `OptionalJwtGuard` (аноним или link-кука), `TelegramAuthGuard` в `src/api/` (Bearer ИЛИ initData Telegram/MAX, ставит `req.webUser`); refresh 30 дн — POST `/api/auth/refresh` с ротацией (`src/auth/refresh-rotation.ts`).

### `src/api/`
Пользовательский HTTP-API мини-аппа и сайта (`/api/*`): один гард на все контроллеры, глобальный троттлинг (в т.ч. общий Postgres-счётчик).
- Контроллеры: api (user-flags, drafts, profile, disclaimer, link-token), ysq, pairs, plans/practices, exercises (healthy-phrase, belief-checks, letters, safe-place, flashcards), notes, tracker (needs, ratings, streak, insights, achievements), diary, phrase-checks, settings, journey, practice-sessions, analytics; без гарда: quiz, public-events, client-errors, health, booking (лид-форма); AccountApiModule — export/delete аккаунта.
- Входы:
  - `src/api/telegram-auth.guard.ts` — единый гард: Bearer JWT / Telegram / MAX initData
  - `src/api/init-data-paths.ts` — тела Telegram- и MAX-веток гарда
  - `src/api/api.module.ts` — реестр контроллеров (+ `src/api/account-api.module.ts`)
  - `src/api/throttler.guard.ts` — UserThrottlerGuard (глобальный APP_GUARD)
  - `src/api/hybrid-throttle-storage.ts` — память или Postgres (`ThrottleHit`) по префиксу ключа
  - `src/api/throttle-error-message.ts` — текст 429 по-русски со сроком из счётчика (`errorMessage` в `throttler-module-options.ts`)
  - `src/api/request-utils.ts` — `uid()` и `parseId()` для контроллеров
- Связи: гард зависит от `src/auth/` (AuthService, MaxProvider, SecurityLogService) и `src/analytics/`; ApiModule импортирует Bot/Notification/Telegram/Therapy/Auth/Analytics/IntroLead; diary и tracker зовут `src/therapy/therapy-tasks.service.ts`; `src/api/throttler-module-options.ts` подключает `src/app.module.ts`.
- Подводные камни:
  - `req.telegramUserId` — number (историческое имя; для веб/MAX-аккаунтов тоже userId); канонический BigInt — `uid(req)`, id из path — `parseId` (Int-колонки) или `parseUserId` (`src/api/parse-user-id.ts`, BigInt); отрицательные id — виртуальные клиенты терапевта.
  - Бакет троттлинга строится только по проверенной подписи (JWT/initData), иначе по IP (`src/api/throttler-identity.ts`); денежные и кодовые ручки обязаны быть с `@PersistentThrottle()` / `@PersistentThrottleLimit` — решение по каждой ручке с `@Throttle` проверяет CI-гейт `scripts/check-persistent-throttle.mjs`.
  - Контроллер без гарда допустим только из `PUBLIC_BY_DESIGN` (`src/security/controller-classification.ts`) и обязан быть в `controllers` какого-то модуля; `src/api/booking.controller.ts` (POST /api/booking) зарегистрирован в `src/booking/intro-lead.module.ts`, а не в ApiModule.

### `src/security/`
Защита от регрессий безопасности: реестры классификации маршрутов и площадок, конфиг helmet/CSP и 21 спек-«трипваер» (`*.invariants.spec.ts`: route-auth, csrf, log-leak, ssrf, injection, dto-validation, crisis-path по фронтендам).
- Входы:
  - `src/security/controller-classification.ts` — контроллеры: guarded / admin-key / PUBLIC_BY_DESIGN
  - `src/security/anonymous-routes.ts` — анонимные методы внутри guarded-контроллеров
  - `src/security/helmet-config.ts` — CSP и заголовки helmet (подключает main.ts)
  - `src/security/embedders.ts` — площадки-iframe: CSP frame-ancestors и SameSite=None
  - `src/security/collect-source-files.ts` — единственный обход дерева исходников
- Связи: спеки читают исходники всего `src/` (и `.tsx` фронтендов) и используют `src/test-support/route-method-auth.ts`; `src/security/helmet-config.ts` — прод-код; `src/security/embedders.ts` сверяется с куками `src/auth/auth-http.util.ts` через `src/security/csrf.invariants.spec.ts`.
- Подводные камни:
  - Новый `*.controller.ts` без `@UseGuards(TelegramAuthGuard|JwtAuthGuard|OptionalJwtGuard)`, `assertAdminKey` или записи в реестр — красный `src/security/route-auth.invariants.spec.ts`; allowlist'ы только сокращаются, добавление — с ревью безопасности.
  - Рекурсивный обход `src/` в спеках — только через `collectSourceFiles` (гейт `src/test-support/gates/source-walk.spec.ts`).

### `src/therapy/`
Кабинет терапевта: связь терапевт↔клиент (код-приглашение, виртуальные офлайн-клиенты), заметки по сессиям, концептуализация, карты режимов, задания клиенту, заявка на роль терапевта (`therapist-request.*`).
- Входы:
  - `src/therapy/therapy-relations.service.ts` — связи; `assertHasClient`/`assertRelation` (барьер доступа)
  - `src/therapy/therapy-connection.controller.ts` — invite/join/relation/former-therapist/clients/request/become-therapist/therapist-role
  - `src/therapy/therapy-invites.controller.ts` — живые приглашения терапевта (`GET invites`, `DELETE invites/:id`) и предпросмотр кода для экрана согласия (`POST invite/preview`); логика — `src/therapy/therapy-invite-list.ts`
  - `src/therapy/therapy-client-data.service.ts` — данные клиента для терапевта, запрос YSQ
  - `src/therapy/therapy-tasks.service.ts` — задачи (свои и назначенные), стрик-прогресс
  - `src/therapy/assigned-task.ts` — удаление и отметка «выполнено» задания терапевтом (офлайн-клиенту выполнить его некому); доступ — задание назначено этим терапевтом и связь активна, иначе 403
  - `src/therapy/dto/not-future-day.ts` — валидатор `NotFutureDay`: «начало терапии» не позже самого позднего «сегодня» на Земле (UTC+14)
  - `src/therapy/therapist-request.service.ts` — заявка на роль терапевта
  - `src/therapy/therapist-exit.service.ts` — отказ от роли (`DELETE therapist-role`, событие `therapist_resigned`) и бывший терапевт клиента (`GET former-therapist`, `former-therapist-info.ts`)
- Связи: Prisma (TherapyRelation, TherapistNote, ClientConceptualization, ModeMap, TherapistCustomMode, UserTask, TherapistRequest); импортирует Bot/Notification/Auth/Analytics; сервисы зовут `src/api/` (diary, tracker → TherapyTasksService) и `src/telegram/`; все 6 контроллеров — `/api/therapy/*` под `TelegramAuthGuard`.
- Подводные камни:
  - Доступ терапевта к чужим клиническим данным закрыт только `assertHasClient`; виртуальный клиент = отрицательный id `-TherapyRelation.id` (`clientId: null`, `src/therapy/relation-where.ts`), его `UserTask` лежат с отрицательным userId без FK и чистятся вручную (`src/therapy/remove-client.ts`).
  - `RelationStatus`: pending/active/ended — `ended` (отказ от роли, `src/therapy/end-therapist-relations.ts`, с `endedAt`/`endReason`, `src/therapy/relation-end-reason.ts`) не оживает; карты и задания бывшего терапевта остаются у клиента как история; срок кода-приглашения считается по `createdAt` (колонки expiresAt нет), захват кода атомарный (`src/therapy/therapy-invite-claim.ts`).
  - Код приглашения — 12 hex-знаков, длина одна с полями ввода фронтов (`INVITE_CODE_LENGTH` ↔ `shared/src/therapy/inviteCode.ts`, сверка `src/therapy/therapy-invite-code.parity.spec.ts`). Каждый `POST invite` — новый код; живых не больше `MAX_LIVE_INVITES` (409 `too_many_invites`). Имя из «Новый клиент» едет в `clientAlias` приглашения — офлайн-карточка при этом не создаётся: её данные висят на `-TherapyRelation.id` и в связь с аккаунтом не переезжают (инцидент 2026-10-26).

### `src/booking/`
Запись на консультации и деньги: слоты, бронь, оплата Robokassa, .ics, админка записи, календарь CalDAV, ссылки на встречи (Zoom/Jitsi), подписки/донаты, заявки с формы знакомства (IntroLead).
- Входы:
  - `src/booking/booking.service.ts` — бронь: создание, подтверждение, отмена, cron `expireHolds`
  - `src/booking/booking.transitions.ts` — переходы статуса брони (CAS)
  - `src/booking/slot.service.ts` — свободные слоты: правила, брони, override, CalDAV
  - `src/booking/payment.controller.ts` — вебхук Robokassa: брони, донаты, подписки
- Связи: Prisma (Booking, AvailabilityRule, SlotOverride, BookingSetting, ClientMeeting, IntroLead); `src/booking/booking.registry.ts` собирает BookingModule вместе с `src/donation/` и `src/subscription/`; `src/booking/intro-lead.module.ts` — отдельный модуль (контроллер в `src/api/booking.controller.ts`); `src/booking/admin-key.util.ts` используют admin-контроллеры `src/articles/` и `src/site-content/`.
- Подводные камни:
  - Публичные ручки без JWT: доступ к брони — capability-токен (`by-token`, `ics`, `cancel/:token`); админка `/api/booking/admin/*` — заголовок `x-admin-key` = `ADMIN_BOOKING_KEY` (≥32 символов).
  - Статус (HELD→CONFIRMED→CANCELLED/COMPLETED) меняется только CAS: `updateMany` с текущим статусом в WHERE, эффекты — по `count===1`; создание — под `pg_advisory_xact_lock` (`src/booking/booking-slot-lock.ts`); HELD сгорает по крону раз в минуту под leader-lease.
  - Один вебхук `/api/payment/result` роутит по диапазону InvId (подписки, донаты, брони); без настроенной Robokassa в проде платный путь отдаёт 503 (`src/booking/payment-guard.ts`); PII брони зашифрована (`src/booking/booking.schema.ts`) и затирается через 12 мес.

### `src/infra/`
Операционный каркас: leader-election кронов, проверка env и реестр возможностей при старте, самопроверка прода (пробы), ретеншен, HTTP-края (прокси, хост, тело), конфиг бэкапов в R2.
- Входы:
  - `src/infra/cron-leader.service.ts` — `claimRun(name, LEASE_WINDOW.*)`: аренда крона строкой `CronLease`
  - `src/infra/env-registry.ts` — реестр env (форматы); записи в `env-registry.entries.*.ts`
  - `src/infra/env-check.ts` — проверка env при старте + кросс-проверки `env-check.*.ts`
  - `src/infra/capability-report.ts` — реестр «фича молча выключена без env»
  - `src/infra/self-check/self-check.service.ts` — крон `43 * * * *` и прогон через 60 с после старта
  - `src/infra/self-check/registry.ts` — список проб (`registry.config|db|live.ts`)
- Остальные сервисы (по строке на группу):
  - `src/infra/self-check/state.ts` (снимок для `/health` и `/stats`), `src/infra/self-check/alert-tracker.ts` (DM только по смене состояния), `src/infra/self-check/cron-lease-registry.ts` (аренды кронов ↔ исходники)
  - `src/infra/db-outage.service.ts` — закрывает аварию БД и шлёт DM о восстановлении; `src/infra/session-retention.service.ts` — чистка WebSession/EmailToken
  - HTTP-края: `src/infra/trust-proxy.ts` (один хоп), `src/infra/request-host.ts` (хост из Host), `src/infra/canonical-host.ts` (301 на apex), `src/infra/body-limit.ts` и `src/infra/body-parsers.ts` (потолок тела 256 КБ), `src/infra/static-cache.ts`
  - Бэкапы: `src/infra/backup-config.ts`, `src/infra/backup-capability.ts`, `src/infra/s3-sigv4.ts`, `src/infra/s3-list-objects.ts` (проба свежести в Cloudflare R2; сам прогон — `deploy/backup-scheduler.cjs`); `src/infra/deploy-target.ts` (`DEPLOY_TARGET=vps`)
  - AlertLogger — вне infra: `src/logger/alert.logger.ts`; доставка — `src/utils/admin-alert.ts`
  - Троттлинг-хранилище — вне infra: `src/api/hybrid-throttle-storage.ts` + `src/api/postgres-throttle-storage.ts`
- Связи: Prisma (CronLease, WebSession, EmailToken); `CronLeaderModule` — @Global, `claimRun` зовут кроны booking/, auth/, channel/, telegram/; `SelfCheckService` и `ThrottleHitModule` регистрируются в `src/app.module.ts`; `src/main.ts` вызывает boot-проверки env и capability; пробы читают `src/cli/rotate-encryption/delegates.ts` и `src/utils/alert-email-health.ts`.
- Подводные камни:
  - `logger.error(...)` в проде = DM админу и e-mail (AlertLogger шлёт только первый аргумент, с троттлингом): в нём ни секретов, ни клиентского текста; ожидаемые сбои — `warn`.
  - Новый `@Cron` с записью/рассылкой берёт `claimRun` (иначе дубль на втором инстансе; исключения — `scripts/cron-leader-baseline.json`) и вносится в `src/infra/self-check/cron-lease-registry.ts`; новая env — в `env-registry.entries.*.ts` (гейт `scripts/check-env-registry.mjs`), фича, выключаемая отсутствием env, — в `src/infra/capability-report.ts` (гейт `scripts/check-capability-registry.mjs`).

### `src/prisma/`
Доступ к Postgres: глобальный PrismaService (Prisma + driver-adapter pg), фильтр Prisma-ошибок → 4xx, одноразовые «волны» дошифровки старых строк при старте. Схема и миграции — вне src: `prisma/schema.prisma`, `prisma/migrations/`.
- Входы:
  - `src/prisma/prisma.service.ts` — PrismaClient + пул pg (keepAlive, ретраи connect, `statement_timeout`), строка владельцу о таймауте (`$on('error')`)
  - `src/prisma/statement-timeout.ts` — порог 30 с и рубильник `DB_STATEMENT_TIMEOUT_MS`, распознавание 57014, исключение `withStatementTimeout`
  - `src/prisma/prisma.module.ts` — @Global, экспортирует PrismaService
  - `src/prisma/prisma-exception.filter.ts` — коды Prisma → дружелюбные 4xx
  - `src/prisma/http-exception-body.ts` — тело HttpException в форме Nest (строка → `{ statusCode, message }`)
  - `src/prisma/encryption-wave2.service.ts` и `src/prisma/encryption-wave3.service.ts` — дошифровка старых строк на старте
  - `src/prisma/unique-violation.ts` — детектор P2002 / SQLSTATE 23505
- Связи: используется почти всеми модулями (PrismaModule глобальный); фильтр подключён в `src/main.ts` (`useGlobalFilters`); волны шифруют через `src/utils/encrypt-if-plain.ts` и хранят флаг-гард в `BookingSetting`.
- Подводные камни:
  - Волны идемпотентны и не роняют старт при ошибке (флаг не ставится — повтор на следующем старте); wave3 обновляет условно (`where` со старым значением), чтобы не затереть свежую запись приложения.
  - Предел — на каждый запрос, параметр сессии пула, а не `DATABASE_URL`: `prisma migrate deploy` его не получает. Свой `PrismaClient` вне `PrismaService` берёт `buildPrismaAdapter(порог)`; VACUUM в `withStatementTimeout` не обернуть (в транзакции запрещён).
  - В `logger.error` фильтра идёт только маскированный путь (`src/prisma/safe-request-path.ts`) + код ошибки: первый аргумент уходит в DM админу (AlertLogger), сырой `req.url` и `exception.message` туда нельзя.

### `src/utils/`
Сквозные утилиты без DI: шифрование (AES-256-GCM, ротация ключей) и реестр решений о шифровании полей, админ-алерты с троттлингом, лимиты текста, таймзоны, BigInt-JSON.
- Входы:
  - `src/utils/crypto.ts` — encrypt/decrypt; ключи `ENCRYPTION_KEY` + `ENCRYPTION_KEY_OLD`
  - `src/utils/crypto-record.ts` — encryptRecord/decryptRecord по `EncryptSchema`
  - `src/bot/encrypted-rows.ts` — `decryptRecord`/`read*` для ответа ручек записи: ответ create = GET той же записи, без шифротекста (сверка — `src/utils/encrypted-write-response.spec.ts`)
  - `src/utils/encryption-policy.ts` — `FIELD_POLICY`: каждое поле Prisma — enc или plain
  - `src/utils/admin-alert.ts` — notifyAdminWithFallback: Telegram, затем e-mail
  - `src/utils/text-limits.ts` — пределы длины текста (лимит только в DTO `@MaxLength`)
  - `src/utils/calendar-day.ts` — валидатор `IsCalendarDay`: настоящий день `YYYY-MM-DD` в DTO (не `2026-02-31`), разбор в UTC (№25)
  - `src/utils/ysq.ts` — скоринг YSQ; `isYsqScoreActive` — единственный критерий «схема выражена» (средний от 4 или больше половины «5–6»), флаг `active` у каждой схемы в ответе — его читают экраны терапевта (`shared/src/therapy/ysqExpression.ts`)
- Связи: crypto/crypto-record/encryption-policy используют сервисы с PII (therapy/, booking/, auth/, bot/); `src/account/data-export.service.ts` читает `FIELD_POLICY` в рантайме; `src/utils/encrypt-migration.ts` запускает `src/main.ts` (статус → `src/infra/self-check/clinical-labels-status.ts`); `src/utils/admin-alert.ts` зовут `src/auth/security-log.service.ts` и `src/infra/self-check/`.
- Подводные камни:
  - В проде без валидного `ENCRYPTION_KEY` (64 hex) процесс не стартует; вне prod шифрование молча пропускается; `decrypt()` на нераспознанном ключе возвращает вход как есть, поэтому «decrypt(v)===v» не признак plaintext (`src/utils/encrypt-migration.rows.ts`).
  - Новое текстовое/PII-поле Prisma требует записи в `FIELD_POLICY` (`enc`/`plain` с причиной) — иначе красный `src/utils/encryption-coverage.spec.ts`; зашифрованное поле дополнительно вносится в `src/cli/rotate-encryption/targets.ts`.

### `src/cli/`
Консольные скрипты для прода: сейчас только ротация `ENCRYPTION_KEY` (перешифровка всех зашифрованных колонок текущим ключом).
- Входы:
  - `src/cli/rotate-encryption-key.ts` — точка входа (`npm run rotate-encryption`; в образе `node dist/cli/rotate-encryption-key.js`)
  - `src/cli/rotate-encryption/run.ts` — запуск, вывод, код выхода 0/1
  - `src/cli/rotate-encryption/rotate-all.ts` — цикл по моделям; ошибка одной не обрывает остальные
  - `src/cli/rotate-encryption/targets.ts` — список (модель, поля, pk) для перешифровки
  - `src/cli/rotate-encryption/rotate-history.ts` — вложенный JSON `ClientConceptualization.history`
- Связи: использует `src/utils/crypto.ts` (ключи текущий + OLD); `src/cli/rotate-encryption/delegates.ts` делит обход колонок с пробой `src/infra/self-check/probe-encryption-readable.ts`; живой e2e — `test/key-rotation.e2e-spec.ts`.
- Подводные камни:
  - Код выхода 1 и «НЕ ротировано» — часть данных ещё под старым ключом: `ENCRYPTION_KEY_OLD` убирать только при коде 0.
  - Зашифрованное поле без записи в `targets.ts` остаётся под старым ключом (сверка — `src/utils/encryption-rotation-coverage.spec.ts`).

### `src/test-support/`
Общие помощники для jest-спеков (из `nest build` исключены в `tsconfig.build.json`; `src/test-support/exit-code-leak.setup.ts` подключён как jest `setupFilesAfterEnv`).
- Входы:
  - `src/test-support/fake-prisma.spec-helper.ts` — in-memory Prisma: `createFakeTable`, `matchesWhere`, `createFakeTransaction`
  - `src/test-support/route-method-auth.ts` — AST-разбор роутов контроллера по методам; `GUARD_NAMES`
  - `src/test-support/cron-source-scan.ts` — сканер пар `@Cron` + `claimRun` в исходниках
  - `src/test-support/fake-s3.ts` — поддельный S3/R2, сверяет подпись SigV4
  - `src/test-support/fake-telegram-api.ts` — поддельный Bot API для шовных тестов поллинга
- Прочее: `src/test-support/load-with-keys.ts` (модули под заданными ENCRYPTION_KEY), `src/test-support/recorded-fixture.ts` (читает `test/fixtures/recorded/**`), `src/test-support/memory-throttle-reset.ts` (сброс троттлера между e2e), `src/test-support/exit-code-leak.ts` (спек, оставивший `process.exitCode`, краснеет), `src/test-support/esm-to-cjs.transform.cjs` (переводит пакеты `@nestjs/*` 12-й версии — только ESM — в CommonJS для jest на Node 22; подключён трансформером `transform` + списком `transformIgnorePatterns` в `package.json` (jest) и `test/jest-e2e.json`; список пакетов в четырёх местах сверяет `esm-to-cjs.transform.spec.ts`; удалить вместе с обоими списками, когда CI перейдёт на Node 24.9+, где jest сам грузит ESM через require; прод на Node 22.12+ грузит их штатно через `require(esm)`), `src/test-support/subscription-update-many.ts`, `src/test-support/run-script.ts`, `src/test-support/vps-bootstrap-sandbox.ts`
- Связи: спеки всего `src/**`; `src/security/*.invariants.spec.ts` берут `route-method-auth.ts`, `src/infra/self-check/cron-lease-registry.spec.ts` — `cron-source-scan.ts`; e2e на реальном Postgres и их `fake-prisma` лежат вне src, в `test/e2e-support/`.
- Подводные камни:
  - `GUARD_NAMES` в `src/test-support/route-method-auth.ts` — единственный список гардов: по нему идёт и разбор по методу, и файловый `GUARD_RE`.

### `src/test-support/gates/`
Тесты CI-гейтов: ≈70 спеков (в основном по одному на `scripts/check-*.mjs`), которые гоняют реальный скрипт как чёрный ящик в tmp-песочнице, плюс чистые правила над `.github/`.
- Входы:
  - `src/test-support/gates/gate-sandbox.ts` — `runGate(script, files, opts)`: копирует реальный скрипт в tmp
  - `src/test-support/gates/pattern-loader.ts` — грузит `PATTERNS` из .mjs-гейта как данные
  - `src/test-support/gates/workflow-yaml.ts` — построчный разбор workflow (`on:`, джобы)
  - `src/test-support/gates/step-script.ts` — значение `run:` шага так, как его получит shell (склейка plain/`>`-скаляра YAML и `\`-продолжений), для гейта `lockfile-audit`
  - `src/test-support/gates/fake-npm.ts` — поддельный `npm` на PATH с записанными ответами реестра для исполнения `scripts/npm-audit.mjs` и ночного шага audit
  - `src/test-support/gates/deploy-needs-ci.ts`, `src/test-support/gates/job-timeouts.ts`, `src/test-support/gates/dependabot-coverage.ts`, `src/test-support/gates/lockfile-audit.ts`, `src/test-support/gates/alarm-needs.ts` — правила над workflow и dependabot.yml
- Связи: спеки запускают `scripts/check-*.mjs` и читают `scripts/*-baseline.json`, `.github/workflows/*.yml`, `.github/dependabot.yml`; те же скрипты CI вызывает шагами в `.github/workflows/ci.yml`; сами спеки идут в обычном `jest` (rootDir `src`).
- Подводные камни:
  - Гейт-скрипт держит scan/report за `if (isMain)`, иначе `src/test-support/gates/pattern-loader.ts` получит побочные эффекты при импорте; `runGate` копирует и локальные зависимости скрипта (`withLocalDeps`).
  - Не все спеки песочничные: `src/test-support/gates/source-walk.spec.ts` и `src/test-support/gates/ci-concurrency.spec.ts` сами сканируют репозиторий и являются гейтом.
