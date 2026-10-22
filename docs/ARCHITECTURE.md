# Карта проекта

> Читать первым, до кода. Здесь только оглавление: куда идти по задаче и что где лежит.
> Подробности — в `docs/architecture/<область>.md`, по разделу на модуль. Карта врёт или
> молчит — исправь строку в том же PR и запиши промах в [docs/agent/NAV_LOG.md](agent/NAV_LOG.md).
> Полноту карты держит гейт `check-agent-docs.mjs`: новый каталог модуля или гейт без строки
> здесь (или в `docs/architecture/`) краснит CI.

| Файл | Что внутри |
|---|---|
| [architecture/backend-core.md](architecture/backend-core.md) | Бутстрап (`src/main.ts`, `src/app.module.ts`), хосты, бот и доменный слой, уведомления, канал, аналитика, статьи, тесты-квизы, деньги (донаты, подписки), логгер |
| [architecture/backend-platform.md](architecture/backend-platform.md) | Вход и сессии, HTTP-API и гарды, безопасность, кабинет терапевта, запись и оплата, инфраструктура (кроны, env, самопроверка), Prisma, утилиты, тест-хелперы |
| [architecture/frontends.md](architecture/frontends.md) | webapp (роутинг, кабинет, токены), мини-апп (навигация без роутера, «Назад», сборка), shared (все подкаталоги), игра, подводные камни |
| [architecture/data-deploy-ci.md](architecture/data-deploy-ci.md) | Модели БД по доменам, миграции, Dockerfile и супервизор, VPS, джобы CI, nightly, смок прода, раскладка тестов |
| [architecture/gates.md](architecture/gates.md) | Таблица всех гейтов CI (что ловит, бейслайн, `--update`, джоба) и команды для локальной проверки |
| [architecture/glossary.md](architecture/glossary.md) | Словарь: как говорит владелец («Мой путь», «ЗВ», «визитка») → где это в коде |

## Куда идти по задаче

| Задача | Начни с | Правило темы |
|---|---|---|
| Новый раздел кабинета сайта | `webapp/src/App.tsx` (`appRoutes`, роут с `element: null`) + `webapp/src/components/appShell/navigation.ts` + `webapp/src/sections/` | frontend, frontend-visual, texts |
| Новая шторка или экран мини-аппа | `schema-miniapp/src/App.tsx`, `schema-miniapp/src/hooks/useSheets.ts`, ключ в `schema-miniapp/src/hooks/anyOverlayOpen.ts` + closer в `schema-miniapp/src/hooks/overlayClosers.ts` | frontend |
| Код или контент для обоих фронтендов | `shared/src/<область>/`; фронты импортируют относительным путём | frontend |
| Метод API для обоих фронтендов | `shared/src/api/sharedApi.ts` (`buildSharedApi`) | frontend |
| Полноэкранный лист сайта | `webapp/src/hooks/useHistorySheet.ts` | frontend |
| Новый эндпоинт | контроллер в `src/api/api.module.ts`, гард `src/api/telegram-auth.guard.ts`, `uid(req)` из `src/api/request-utils.ts`, DTO; e2e-смок ownership в `test/` | backend-api, tests |
| Публичная ручка без входа | `src/security/controller-classification.ts` (`PUBLIC_BY_DESIGN`) | backend-api, security |
| Вход, сессии, привязка, слияние | `src/auth/auth-flow.service.ts`, `src/auth/providers/registry.ts`, `src/auth/merge.service.ts` | security |
| Данные пользователя (доменная логика) | `src/bot/` — это НЕ Telegram-бот, а доменный слой: `src/bot/bot.service.ts`, `src/bot/bot.module.ts` | data |
| Новая таблица с `userId` | `prisma/schema.prisma`, `src/bot/user-data-tables.ts`, `src/auth/user-owned-tables.ts`, `src/utils/encryption-policy.ts` | data, security |
| Миграция | `prisma/migrations/<ГГГГММДДччммсс>_<имя>/migration.sql` | data |
| Запрос упирается в таймаут БД, долгая операция | `src/prisma/statement-timeout.ts` (`withStatementTimeout`, `DB_STATEMENT_TIMEOUT_MS`) | data |
| Команда или кнопка бота | `src/telegram/telegram.service.ts` и соседние `src/telegram/telegram.*.service.ts` (хендлеры регистрируются в `onModuleInit`) | telegram, texts |
| Текст уведомления | `src/notification/notification.templates.ts`, форма ты/вы — `src/notification/address-form.ts` | texts |
| Обращение ты/вы во фронте | `shared/src/utils/addressForm.ts` (`useTr`) | texts |
| Новый крон | `src/infra/cron-leader.service.ts` (`claimRun`), `scripts/cron-leader-baseline.json`, `src/infra/self-check/cron-lease-registry.ts`; обход, который доделывается после рестарта, — `finishRun` (`src/infra/cron-run-done.ts`) и `COMPLETING_LEASES` (`src/infra/self-check/cron-lease-done.ts`), образец — `src/telegram/telegram.midnight-planner.ts` | ops |
| Событие аналитики и блок `/stats` | `src/analytics/analytics.constants.ts`, `src/api/analytics-meta.sanitize.ts`, `src/bot/stats-report.service.ts`, `shared/src/share/analytics.ts` | analytics |
| Запись на консультацию, оплата | `src/booking/booking.service.ts`, `src/booking/slot.service.ts`, `src/booking/payment.controller.ts` | backend-api, data |
| Кабинет терапевта | `src/therapy/therapy-relations.service.ts` (`assertHasClient`), `shared/src/therapy/` | security |
| Env-переменная | `src/infra/env-registry.ts` + `docs/ENV.md` | ops |
| Внешняя интеграция | проба в `src/infra/self-check/registry.ts` | ops |
| Хост, редирект, визитка | `src/practice-domain.middleware.ts`, `src/practice-domain.surface.ts`, `src/infra/canonical-host.ts` | backend-api |
| Статья сайта | `src/articles/articles.seed.ts` (+ поднять `SEED_VERSION` в `src/articles/articles.service.ts`), [docs/ARTICLES.md](ARTICLES.md) | texts, telegram |
| Фраза канала «Здоровый Взрослый» | `src/bot/healthy-adult.data.ts` + миграция; площадки — `src/channel/channel.providers.ts` | telegram, texts |
| Красный CI | [architecture/gates.md](architecture/gates.md) → строка гейта → его шапка | gates |
| Конфликт слияния | `git fetch origin main && git merge origin/main` локально | gates (№13) |
| Прод лёг, деплой не доехал | `deploy/entrypoint.mjs`, [docs/RUNBOOKS.md](RUNBOOKS.md) (grep по сервису) | ops |
| Задача размыта | `/grill-me` | — |
| Где живёт X (шире одного grep) | субагент `scout` | — |
| Перед PR | субагент `rules-reviewer` по диффу | все темы диффа |
| Контекст на исходе, задача переезжает | `/handoff` | — |
| Задача закончена, поиск шёл долго | `/retro` + `node scripts/agent/session-report.mjs` | docs |

«Правило темы» — файл `.claude/rules/<тема>.md`; подгружается сам, когда открываешь файлы области.

## Как устроено целиком

- **Один бэкенд, два фронтенда.** NestJS в `src/` отдаёт `/api/*` и статику: сайт (сборка webapp) на `/`, мини-апп `schema-miniapp/dist` на `/app/`, игру на `/game/`. Telegram-бот (Telegraf, long polling) живёт в том же процессе.
- **Путь запроса:** компонент → `api.метод()` (`webapp/src/api.ts` или `schema-miniapp/src/api.ts`, общая часть — `shared/src/api/sharedApi.ts`) → `authedFetch` → `/api/...` → гард `src/api/telegram-auth.guard.ts` (Bearer JWT или initData Telegram/MAX) → контроллер → сервис → Prisma.
- **Данные общие, если совпадает `userId`.** Вход через Telegram на сайте и мини-апп дают один и тот же `userId = telegramId`. Вход через Google/VK/MAX/почту — отдельный веб-`userId`; данные мини-аппа подтягиваются после «Привязать Telegram» в `/account` и подтверждённого слияния (`src/auth/merge.service.ts` переносит строки по всем `USER_OWNED_TABLES` в транзакции).
- **Слои:** логика — в `src/bot/` (доменный слой), Telegram-UI — в `src/telegram/`. Не смешивай: новая функциональность — сначала логика в `src/bot/bot.service.ts` (или соседнем сервисе), потом UI в `src/telegram/telegram.service.ts`.
- **Хосты:** приложение — только `schemehappens.ru`; `kotlarewski.gr` — визитка практики (allow-list в `src/practice-domain.surface.ts`), всё остальное с неё 301 на канонический хост.
- **Деплой:** push в `main` = деплой. Amvera собирает `Dockerfile` (webapp и игра собираются в образе, `schema-miniapp/dist` берётся из git); контейнер стартует `deploy/entrypoint.mjs`: ждёт БД → `prisma/recover-p3009.sql` → `prisma migrate deploy` → приложение.

## Харнесс агентов

| Что | Где | Когда работает |
|---|---|---|
| Карта правил | `CLAUDE.md` | всегда в контексте (бюджет — `check-agent-docs.mjs`) |
| Полные тексты правил | `.claude/rules/<тема>.md` | сами, по маске `paths:` при чтении файла области |
| Навыки | `.claude/skills/` — `/grill-me`, `/retro`, `/handoff` | по вызову; в контексте только описание |
| Субагенты | `.claude/agents/` — `scout` (haiku, поиск по карте), `ci-doctor` (разбор красного CI), `rules-reviewer` (ревью диффа по правилам) | по делегированию; `scout` и `ci-doctor` без `CLAUDE.md` |
| Настройки | `.claude/settings.json` — модель субагентов `sonnet`, потолки вывода Bash/Read/MCP, запрет чтения dist и lock-файлов, хуки | всегда |
| Замер контекста | хук `.claude/hooks/log-tool-use.mjs` → журнал .claude/state/tool-log.jsonl (локальный, не в git) → `scripts/agent/session-report.mjs` | каждый вызов инструмента и загрузка правила |
| Проверка перед пушем | `scripts/agent/precheck.mjs` (список гейтов — из `ci.yml`, логика — `precheck-lib.mjs`, `precheck-tree.mjs`) | перед `git push` и в `rules-reviewer`: быстрые гейты CI в чистом worktree, вывод — только красное |
| Подсказка на старте | хук `.claude/hooks/session-start.mjs` — одна строка, только если чего-то не хватает (нет `node_modules`) | начало сессии |
| Журнал промахов карты | [docs/agent/NAV_LOG.md](agent/NAV_LOG.md) | дописывает агент, разбирает `/retro журнал` |

## Каталоги репозитория

| Каталог | Что |
|---|---|
| `src/` | NestJS-бэкенд и бот; модули — таблица ниже |
| `webapp/` | Сайт schemehappens.ru и визитка (React + Vite, react-router); сборка webapp живёт только в Docker-образе |
| `schema-miniapp/` | Мини-апп Telegram/MAX на `/app/` (React + Vite, без роутера); `dist/` коммитится |
| `shared/` | Общий код обоих фронтендов: типы, логика, хуки, контент, компоненты, CSS-токены (не npm-пакет) |
| `prisma/` | `prisma/schema.prisma`, миграции, `prisma/recover-p3009.sql` |
| `test/` | e2e бэкенда (`test/*.e2e-spec.ts`), `test/e2e-support/`, записанные ответы площадок `test/fixtures/recorded/`, замер планов `test/perf/` |
| `e2e-browser/` | Playwright-смоки (nightly) |
| `scripts/` | Гейты CI `scripts/check-*.mjs`, их бейслайны, merge-драйверы, бэкапы |
| `deploy/` | Супервизор контейнера, VPS (`deploy/vps/`), Cloudflare Worker (`deploy/threads-relay/`) |
| `docs/` | Документация: индекс — [docs/README.md](README.md), открытое — `docs/open/`, архив — `docs/archive/` |
| `game/` | Игра (Phaser), заморожена: не трогать без прямой просьбы |
| `assets/` | Шрифты для карточек шаринга и корневой сертификат для MAX (`assets/ca/russian-trusted-root.pem`) |

## Модули бэкенда (`src/`)

| Модуль | Отвечает за | Подробно |
|---|---|---|
| `src/bot/` | Доменный слой: потребности, оценки, дневники, YSQ, упражнения, практики, пары, «Мой путь», пул фраз канала, метрики `/stats` | backend-core |
| `src/telegram/` | Telegraf: `/start`, онбординг, тесты, настройки, админ-команды, отправка очереди уведомлений | backend-core |
| `src/channel/` | Посты канала «Здоровый Взрослый» в Telegram, VK, MAX, Threads, Pinterest | backend-core |
| `src/notification/` | Очередь и планировщик напоминаний, адаптивная частота, шаблоны, ты/вы бэкенда | backend-core |
| `src/analytics/` | Allow-list событий и запись `AnalyticsEvent` | backend-core |
| `src/articles/` | Статьи сайта, SEO для краулеров, `sitemap.xml` | backend-core |
| `src/quiz/` | Публичные мини-тесты (бот и сайт) | backend-core |
| `src/site-content/` | Редактируемые блоки лендинга | backend-core |
| `src/account/` | Выгрузка всех данных пользователя | backend-core |
| `src/donation/` | Донаты через Robokassa | backend-core |
| `src/subscription/` | Подписки с рекуррентными списаниями | backend-core |
| `src/logger/` | `AlertLogger`: `logger.error` → DM админу с троттлингом | backend-core |
| `src/types/` | Расширение `express.Request` полями гардов | backend-core |
| `src/auth/` | Вход (Telegram, Google, VK, MAX, почта), JWT + refresh, 2FA, билеты входа, слияние | backend-platform |
| `src/api/` | Пользовательский `/api/*`: контроллеры, единый гард, троттлинг | backend-platform |
| `src/security/` | Классификация маршрутов, CSP, спеки-трипваеры безопасности | backend-platform |
| `src/therapy/` | Кабинет терапевта: связи, заметки, концептуализация, задания, заявки | backend-platform |
| `src/booking/` | Запись, слоты, оплата, CalDAV, встречи, заявки с формы | backend-platform |
| `src/infra/` | Аренда кронов, env-реестр, самопроверка, HTTP-края, бэкапы | backend-platform |
| `src/prisma/` | `PrismaService` (глобальный), предел запроса `statement-timeout.ts`, фильтр ошибок Prisma, волны дошифровки | backend-platform |
| `src/utils/` | Шифрование и его реестр, админ-алерты, лимиты текста, таймзоны | backend-platform |
| `src/cli/` | Ротация `ENCRYPTION_KEY` | backend-platform |
| `src/test-support/` | Хелперы jest, фейки Prisma/S3/Telegram; `src/test-support/gates/` — тесты гейтов | backend-platform |

Корневые файлы `src/`: `src/main.ts` (бутстрап), `src/app.module.ts`, `src/practice-domain.middleware.ts` (визитка), `src/unified-frontend.middleware.ts` (увод `/app/*` в кабинет за флагом).

## Фронтенды — верхний уровень

Подробно, включая все подкаталоги `shared/src/*/`, — [architecture/frontends.md](architecture/frontends.md).

- **webapp:** `webapp/src/App.tsx` — все роуты (`personalRoutes` для визитки, `appRoutes` для продукта); `webapp/src/pages/` — страницы-роуты; `webapp/src/sections/` — разделы кабинета; `webapp/src/components/` — остальной UI; `webapp/src/hooks/`, `webapp/src/utils/`, `webapp/src/auth/`, `webapp/src/host/`, `webapp/src/styles/`.
- **schema-miniapp:** `schema-miniapp/src/App.tsx` — секции на `useState`, нижнее меню, шторки; `schema-miniapp/src/sections/`, `schema-miniapp/src/components/`, `schema-miniapp/src/hooks/`, `schema-miniapp/src/utils/`, `schema-miniapp/src/share/`.
- **shared:** `shared/src/<область>/` — по каталогу на фичу (`shared/src/therapy/`, `shared/src/journey/`, `shared/src/practices/`…), `shared/src/theme/` — CSS-токены, `shared/src/api/` — общий API.

## Команды

```bash
npx tsc --noEmit -p tsconfig.build.json   # типы бэкенда (голый tsc из корня падает на e2e-browser/ — норма)
npx jest src/путь/x.spec.ts               # один спек; npx jest — все
npm test --prefix webapp                  # vitest; так же --prefix schema-miniapp, --prefix shared
npm run build --prefix schema-miniapp     # после правки мини-аппа или shared — и закоммитить dist
node scripts/check-<имя>.mjs              # любой гейт; список — architecture/gates.md
npx prisma generate                       # после правки prisma/schema.prisma
```
