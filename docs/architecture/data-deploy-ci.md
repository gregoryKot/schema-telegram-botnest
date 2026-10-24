# Карта: данные, деплой, CI, тесты

> Подробности к [docs/ARCHITECTURE.md](../ARCHITECTURE.md). Читай раздел нужного модуля
> (`grep -n '^### ' docs/architecture/data-deploy-ci.md`), а не весь файл. Карта врёт или
> молчит — исправь строку в том же PR и запиши промах в [docs/agent/NAV_LOG.md](../agent/NAV_LOG.md).

### Данные (`prisma/`)

`prisma/schema.prisma` (1039 строк): 51 модель и 8 enum (`UserRole`, `RelationStatus`, `RequestStatus`, `PaymentStatus`, `SubscriptionStatus`, `SlotOverrideKind`, `BookingStatus`, `SessionType`). Генератор `prisma-client-js`. В `datasource db` нет `url`: он берётся из `prisma.config.js`.

| домен | модели |
|---|---|
| аккаунт и вход | User, AuthProvider, WebSession, LoginTicket, EmailToken |
| трекер потребностей и тесты | Rating, Note, YsqProgress, YsqResult, YsqResultHistory, ChildhoodRating |
| дневники и самопомощь | SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, DiaryDraft, UserSchemaNote, UserModeNote, UserBeliefCheck, UserPhraseCheck, UserLetter, UserSafePlace, UserFlashcard |
| практики | UserPractice, PracticePlan, PracticeSession |
| терапия и пары | Pair, TherapyRelation, TherapistRequest, UserTask, TherapistNote, ClientConceptualization, TherapistCustomMode, ModeMap |
| запись на консультации | AvailabilityRule, SlotOverride, Booking, IntroLead, ClientMeeting, BookingSetting |
| платежи | Donation, Subscription, SubscriptionCharge |
| контент и канал «ЗВ» | Article, HealthyAdultPhrase, HealthyAdultPost, ChannelDelivery |
| аналитика и уведомления | AppActivity, AnalyticsEvent, ScheduledNotification |
| инфраструктура | CronLease, ThrottleHit |

- Миграции: `prisma/migrations/<YYYYMMDDHHMMSS>_<snake_name>/migration.sql`, сейчас 106 каталогов плюс `migration_lock.toml` (provider postgresql). Генерировать через `npx prisma migrate dev`; рукописный SQL сначала прогнать `migrate deploy` на чистой БД.
- SQL обязан быть идемпотентным целиком: `IF NOT EXISTS`, вставки через `WHERE NOT EXISTS`, `updatedAt` явно (`CURRENT_TIMESTAMP`), потому что Prisma не оборачивает миграцию в транзакцию (правило — `.claude/rules/data.md`). Частичные unique-индексы (например `Pair_active_users_key`) в PSL не выражаются, они живут только в SQL.
- Новая модель с `userId` обязана попасть в `USER_DATA_TABLES` (`src/bot/user-data-tables.ts`) и `USER_OWNED_TABLES` (`src/auth/merge.service.ts`), в реестр шифрования `src/utils/encryption-coverage.spec.ts`, и иметь `onDelete: Cascade`.
- `prisma/recover-p3009.sql`: `DELETE FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL AND pg_try_advisory_xact_lock(72707369)`. Снимает застрявшую запись после P3009, но не трогает миграцию, которая выполняется прямо сейчас. Запускается entrypoint-ом перед каждым `migrate deploy` и вручную через `ops.sh op=migrate-resolve-failed`.
- `prisma.config.js` (CJS): `defineConfig({ datasource: { url: process.env.DATABASE_URL } })`. В Prisma 7 у `db execute` нет `--schema`, URL берётся отсюда. Файл копируется в runtime-образ.

### Деплой

**Dockerfile**, два этапа на `node:22-slim`:
- Стадия `build`:
  - ставит openssl (`deploy/install-openssl.sh`, три попытки с запасным зеркалом);
  - `COPY package*.json` и два скрипта `setup-merge-drivers.mjs` + `merge-drivers-check.mjs`, затем `npm ci` (нужны хуку `prepare`);
  - `npm ci --prefix webapp` и `npm ci --prefix game`;
  - `COPY . .`, затем `BUILD_INFO` (`date -u`), `npx prisma generate`, `npm run build` (nest, `dist/`);
  - `VITE_BOT_USERNAME=SchemeHappensBot` и `npm run build --prefix webapp` (webapp/dist);
  - мини-апп не собирается, `cp -r schema-miniapp/dist/*` в webapp/dist/app/ (dist лежит в git);
  - `npm run build --prefix game` (`prebuild` = `i18n:check`), копия в webapp/dist/game/;
  - `npm prune --production`.
- Стадия runtime:
  - openssl, `postgresql-client` 16 из PGDG и curl (`deploy/install-pg-client.sh`), `NODE_ENV=production`;
  - копируются `package*.json`, прод `node_modules`, `dist`, `prisma/`, `prisma.config.js`, webapp/dist, `assets/`, `BUILD_INFO`;
  - `deploy/` копируется целиком, из `scripts/` только `backup-upload.sh`, `restore-backup.sh`, `backup-fetch-latest.sh`, `s3-api.sh`;
  - `USER node`; `HEALTHCHECK` смотрит тело `/health` на `"status":"ok"`, а не код ответа;
  - `CMD ["node","deploy/entrypoint.mjs"]`.

**`deploy/entrypoint.mjs`** (супервизор, PID 1) по порядку:
1. `front-server.mjs` сразу занимает публичный порт 3000: это TCP-проброс на `APP_PORT` (3001) или страница `maintenance.html`, пока приложение не поднялось или упало.
2. `wait-for-db.mjs` ждёт TCP-порт БД из `DATABASE_URL`, до 120 с.
3. `RECOVER_CMD`, по умолчанию `npx prisma db execute --file prisma/recover-p3009.sql || true`.
4. `MIGRATE_CMD`, по умолчанию `npx prisma migrate deploy`, 3 попытки. Если не прошло, остаются техработы навсегда и приложение не стартует.
5. `backup-scheduler.cjs`: бэкап БД в R2 с арендой через `CronLease`, стартует только после миграций.
6. `exec node dist/main` на `APP_PORT`, с номером запуска, числом падений за сутки и решением троттла DM (`STARTUP_LAUNCH`, `STARTUP_CRASHES_DAY`, `STARTUP_NOTICE`). Рестарты до `STARTUP_MAX_FAILS`=3 падений за окно `STARTUP_CRASH_WINDOW_MS`=15 мин или `STARTUP_MAX_FAILS_HOUR`=6 за час (`crash-window.mjs`), затем техработы, пауза 5 мин (×2, потолок 1 ч) и новая серия. Рост паузы сбрасывает только прогон дольше окна.

SIGTERM/SIGINT пробрасываются приложению.

- `amvera.yml`: `environment: docker`, `toolchain: docker`, `run.containerPort: 3000`. Amvera сама тянет main из GitHub и собирает Dockerfile (README).
- `deploy/vps/`: прод на VPS. `docker-compose.yml` (Postgres + app + Caddy), `Caddyfile` (TLS и reverse proxy), `bootstrap.sh`, `dc.sh`, `ops.sh` (закрытый список операций на сервере), `external-db-check.sh`, `grant-root.sh`, `ssh-setup.sh`, `docker-compose.transfer.yml` (порт 5432 наружу на время переноса БД).
- `deploy-vps.yml`: после успешного push-CI на main собирает образ, пушит в ghcr.io (теги sha и latest), по ssh копирует `deploy/vps`, пишет `.env` из секрета `PROD_ENV`, запускает `ops.sh deploy` (ждёт health до 5 мин, при провале откатывается). Без секретов `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `PROD_ENV` джоба зелёная и ничего не делает.
- `vps.yml`: ручной `workflow_dispatch` с `op` из закрытого списка, только с main, через `ops.sh`. Операции: `status`, `grant-root`, `bootstrap`, `transfer-open/check/close`, `restore-backup`, `external-db-check`, `release-hold`, `restart-app`, `restart-caddy`, `rollback`, `migrate-resolve-failed`.
- Остальное в `deploy/`:
  - `threads-relay/` — Cloudflare Worker (`worker.js` + README), ретранслятор запросов к `graph.threads.net`;
  - `app-exit.mjs` — решение супервизора по выходу приложения;
  - `pg-url-env.cjs` — `DATABASE_URL` в переменные libpq;
  - `transfer-db.sh` — разовый перенос БД Amvera→VPS через `RECOVER_CMD`.

### CI

`.github/workflows/ci.yml`: триггеры `push` на main, `pull_request`, `workflow_dispatch`. Токен только на чтение. PR-прогоны отменяются при новом пуше, прогоны main не отменяются. Рядом лежат `CODEOWNERS`, `dependabot.yml`, `pull_request_template.md` и `rulesets/main.json` — копия ruleset `main` (только через PR, все джобы `ci.yml` обязательны, `strict`; живой — в настройках GitHub, правка — владелец, порядок — правило №13), сверка с джобами — `src/test-support/gates/main-ruleset.spec.ts`.

| джоба | что гоняет (≤15 слов) |
|---|---|
| backend | tsc, coverage-храповик, jest под TZ Sydney, e2e на фейках, npm audit корня и game, 6 храповиков |
| checks | fs-only гейты без `npm ci`, shellcheck `deploy/vps`, `docker compose config` |
| docker | `docker build` прод-образа (`push: false`, кэш gha) |
| migrations | Postgres 16: `migrate deploy` дважды, `migrate diff` против schema.prisma, real-DB e2e |
| perf | сид синтетики, EXPLAIN ANALYZE горячих путей, `check-query-plans.mjs` |
| webapp | build, bundle-size, vitest+coverage, vitest под TZ Sydney, UI-гейты, npm audit |
| shared | coverage-храповик и vitest под TZ Sydney для `shared/`, npm audit |
| eslint | `check-eslint-ratchet.mjs` (ставит зависимости всех пакетов, prisma generate) |
| miniapp | typecheck, build, coverage-храповик, vitest под TZ Sydney, «dist актуален», npm audit |

Шаги npm audit всех джоб зовут обёртку `scripts/npm-audit.mjs <каталог>`: голый `npm audit` висел на реестре до таймаута шага (регресс #814). Попытка до 45 с, до трёх попыток; high/critical — код 4 сразу (не 1: его node отдаёт на упавшем скрипте), «реестр не ответил» — код 2 и отдельный `::error::`, «npm не может проверить» (нет lock-файла) — код 3 без повторов; реестр и `--offline=false` заданы флагами, env и `.npmrc` их не перекрывают. Разбор ответа npm — `scripts/npm-audit-report.mjs`. Шаг засчитывается гейтом, только если скрипт `run:` — одна команда (так, как его склеят YAML и `\`-продолжения shell, — `src/test-support/gates/step-script.ts`) и вызов — её исход: без `||`, `;`, `&`, `|` после него, без `exit`/`trap`/`set +e`, без своего `shell:` и `continue-on-error` с любым значением, кроме `false`. Исполняется с поддельным npm в `src/test-support/gates/npm-audit.spec.ts`.

**nightly.yml** (cron `0 3 * * *` ежедневно и `0 4 * * 0` по воскресеньям, плюс dispatch). Красный nightly не блокирует PR.
- `backend-flaky` — jest три раза подряд через `jest-exit-guard.mjs`, затем `--detectOpenHandles`.
- `frontend-flaky` — vitest webapp ×3, miniapp ×3, shared ×1.
- `mutation-golden-auth` — Stryker, волна А, затем `check-mutation-ratchet`.
- `mutation-golden-payments` — Stryker, волна Б, затем кризис и outbox, каждый с храповиком.
- `browser-smoke` — build webapp, `playwright test` (Chromium + WebKit).
- `backup-restore` — репетиция: зашифрованный бэкап, restore во вторую БД, `migrate diff`, пробы с порчей файла и неверным ключом.
- `mutation-bot` — Stryker по `src/bot`, только воскресенье или dispatch.
- `npm-audit` — `scripts/npm-audit.mjs` (`npm audit --omit=dev --audit-level=high` с таймером на попытку и повторами) по каждому lock-файлу из `git ls-files`, под alarm.
- `alarm` — issue `ci-alarm` и DM в Telegram, если упала любая джоба.

**prod-smoke.yml** (cron `*/15 * * * *`, фактический шаг GitHub 3–7 ч, плюс dispatch):
- `prod-smoke` — curl живого schemehappens.ru: `/health` (`status=ok`, `db=up`, самопроверка, `check-deploy-lag`), `/`, `/app/`, `/game/` по маркерам.
- `alarm` — issue `ci-alarm` и DM, троттлинг напоминаний раз в 3 часа.

### Тесты

- **Юнит (бэкенд):** `src/**/*.spec.ts` (631 файл) рядом с кодом. В `package.json` у jest `rootDir: src`, `testRegex: .*\.spec\.ts$`. `src/test-support/` — хелперы (`fake-prisma.spec-helper`, `fake-s3`). `src/test-support/gates/` (76 файлов) — спеки инвариантов CI и скриптов-гейтов (`job-timeouts`, `ci-concurrency`, `deploy-lag` и т.д.).
- **e2e бэкенда:** `test/*.e2e-spec.ts` (50), конфиг `test/jest-e2e.json` (`rootDir: test`, setup `e2e-support/env.setup.ts` и `setup-e2e.ts`). По умолчанию реальный `AppModule` с фейковыми Prisma и ботом: `test/e2e-support/build-test-app.ts`. С `E2E_REAL_DB=1` и `DATABASE_URL` подключается настоящий Postgres (`build-real-db-test-app.ts`). На живую БД ссылаются 27 спеков, в CI они идут в джобе `migrations` с `--runInBand`.
- **`test/e2e-support/`** (16 файлов): `build-test-app`, `build-real-db-test-app`, `fake-prisma` (+`-engine`), `fake-bot`, `fake-cron-lease`, `jwt`, `cleanup-fixtures`, `throttle-reset.setup`, `jose.stub` и др.
- **`test/fixtures/recorded/`**: записанные ответы внешних площадок (iCloud PROPFIND, S3 ListObjectsV2, AWS SigV4, OAuth, VK ID) и соседний `*.meta.json` (`source`, `recordedAt`, `how`, `redacted`). Контролирует `check-recorded-fixtures`.
- **`test/perf/`**: `seed.ts`, `run-plans.ts`, `scenarios.ts`, `explain.ts`, `record-sql.ts`, `seed-profile.ts` для джобы `perf`. Нужен Postgres после `migrate deploy`: `npx ts-node --compiler-options '{"module":"commonjs"}' test/perf/seed.ts`, затем `.../run-plans.ts`, затем `node scripts/check-query-plans.mjs`.
- **Фронтенды (vitest):** `*.test.ts(x)` рядом с кодом в `webapp/src`, `schema-miniapp/src`, `shared/src` (1021 файл). jsdom включается pragma `// @vitest-environment jsdom` в самом файле. Запуск: `npm test --prefix webapp` (так же `schema-miniapp` и `shared`; везде `vitest run`). Покрытие: `node scripts/check-frontend-coverage-ratchet.mjs --package webapp` (также `schema-miniapp`, `shared`). CI второй раз гоняет vitest с `TZ=Australia/Sydney`.
- **Playwright:** `e2e-browser/` (`a11y-smoke`, `crisis-smoke`, `miniapp-smoke`, `public-pages`, `tracker-smoke`, `a11y-baseline.json`, `support/{miniappStaticServer.mjs,stubApi.ts,stubMiniApp.ts}`). Проекты `webapp` (`vite preview` на :4173), `miniapp` (статик-сервер `schema-miniapp/dist` на :4174) и `miniapp-webkit` (только если есть WebKit или `PW_WEBKIT=1`). Локально: `VITE_BOT_USERNAME=SchemeHappensBot npm run build --prefix webapp`, затем `npm run smoke` (= `playwright test`). В CI гоняется только в nightly `browser-smoke`.
- **Mutation (nightly):** `npm run mutation`, `mutation:golden-auth`, `mutation:golden-payments`, `mutation:crisis`, `mutation:outbox`.
