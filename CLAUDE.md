# Правила проекта

<!--
Для людей (HTML-комментарии в контекст агента не попадают и токенов не стоят).

Этот файл грузится в КАЖДУЮ сессию и в каждого general-purpose субагента,
поэтому здесь только карта: одна строка на правило и ссылка на полный текст.
До 2026-10-21 тут жили полные тексты всех правил — 1694 строки, ~99 тыс.
символов, которые каждый агент оплачивал до первого действия.

Полные тексты (с инцидентами и обоснованием) — в .claude/rules/<тема>.md.
Claude Code подгружает такой файл сам, когда агент читает или правит файл,
подходящий под маску `paths:` в его шапке. Номера правил (№N) не менялись:
на них ссылаются комментарии в коде и сообщения гейтов.

Потолок размера этого файла и связность карты держит
scripts/check-agent-docs.mjs (CI, джоба checks). Новое правило: полный текст
в .claude/rules/<тема>.md + одна строка сюда. Как писать документы —
.claude/rules/docs.md.
-->

Продукт по схема-терапии: NestJS-бэкенд (`src/`) + сайт `webapp/` (schemehappens.ru) + Telegram/MAX мини-апп `schema-miniapp/` (`/app/`) + общий код `shared/`. Данные у площадок общие, если совпадает `userId`. Проектом управляют ИИ-агенты; владелец не пишет код и не мержит.

**Принцип:** правило без механизма принуждения не работает — где можно, правило дублируется гейтом в CI или тестом.

## Как работать, не сжигая контекст (читать первым)

1. **Сначала карта, потом код.** Где что лежит, куда идти по задаче, какой гейт что ловит — [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Код открывай, когда карта довела до файла.
2. **Полный текст правила подгружается сам** при работе с файлами его области (`.claude/rules/*.md`, маска `paths:`). Не подгрузился (Explore-агент, облачный проект) — открой файл из заголовка группы ниже, прежде чем трогать область.
3. **Большое не читать целиком.** `docs/AUDIT_*`, `docs/open/*`, `docs/INCIDENTS.md`, `docs/RUNBOOKS.md`, `.github/workflows/*.yml`, `scripts/*-baseline.json`, `src/articles/articles.seed.ts` — `grep -n` по ключу, потом Read с `offset`/`limit`. `schema-miniapp/dist/`, `package-lock.json`, `docs/archive/` — не читать без прямой нужды.
4. **Задача размыта — сначала договорись:** `/grill-me` допрашивает владельца до общего понимания и записывает ТЗ. Переделка дороже вопросов.
5. **Карта промолчала или соврала — чини карту в том же PR** (строка в `docs/ARCHITECTURE.md` или в правило) и запиши промах строкой в [docs/agent/NAV_LOG.md](docs/agent/NAV_LOG.md). Как писать документы — [.claude/rules/docs.md](.claude/rules/docs.md).
6. **Делегируй.** Основная (дорогая) модель планирует, ревьюит и отвечает за итог; реализация по готовому ТЗ, механические правки и прогоны — субагентам `model: "sonnet"` (совсем механическое — `"haiku"`). Субагент не видит переписку: нужные ему правила повтори в ТЗ. Для поиска по коду — `Explore` (он не грузит этот файл).

## Правила: одна строка; полный текст — в файле группы

### Процесс → [.claude/rules/process.md](.claude/rules/process.md)
- **№1** Ничего не мержится с красным CI: `npx tsc --noEmit -p tsconfig.build.json` (голый `tsc` из корня падает на `e2e-browser/` — норма) + jest + eslint + сборки обоих фронтендов + vitest + `migrate deploy` на живом Postgres.
- **№1а** Мержит агент: открыл PR — дождись CI, красный чини, зелёный — сними драфт и смержи (squash) без вопроса. Мерж в `main` = деплой. Исключение — метка `do-not-merge` или «не мержить» в описании.
- **№20** Починка инцидента приезжает со строкой в `docs/INCIDENTS.md`; один инцидент — один PR; вопрос ревью — «как система узнала бы сама?».
- **№26** Находка вне задачи → строка в `docs/open/<область>.md` в том же PR (что сломано, где — путь, чем доказано), не в тело PR. Осознанно не сделанное — так же, с причиной. Закрыл — убери строку.
- **Бэклог** — `docs/BACKLOG.md`: идея владельца — строка сразу; взял — 🔧 + PR; закрыл — в «Сделано» в том же PR.

### Гейты и параллельные агенты → [.claude/rules/gates.md](.claude/rules/gates.md)
- **№9** eslint: число ошибок не растёт; `no-floating-promises` — error; новых `any` нет; каст Prisma-делегата на `any` запрещён.
- **№10** Новый файл ~150 строк, потолок 300. Файл из `scripts/file-size-baseline.json` может только уменьшаться (`check-file-size-ratchet.mjs`; снизил — `--update`). Разросшийся гейт дробится на движок + `*-rules.mjs`.
- **№11** Один маршрут — один контроллер (`check-route-collisions`); дубли ≥70 токенов не растут (`check-jscpd-ratchet`); у файла есть не-тестовый потребитель (`check-dead-files`); заменил компонент — удали старый в том же PR.
- **№13** Конфликт сводится локально: `git fetch origin main && git merge origin/main` (не кнопкой GitHub). Бейслайны и `schema-miniapp/dist` сводят merge-драйверы — руками не разрешать. Новый `*-baseline.json` = строка в `.gitattributes`. `package-lock.json` — любая сторона + `npm install`.
- **№15** Гейт не замалчивают: не обходить формулировкой, не прятать код в слепые зоны (`game/`, `public/`); исключение — с причиной и тестом-образцом + контрольным образцом; рост бейслайна объясняется в теле коммита.
- `PrismaModule` глобальный — не регистрируй `PrismaService` в других модулях. Новый файл — только по необходимости.

### Фронтенды: код и сборка → [.claude/rules/frontend.md](.claude/rules/frontend.md)
- **№2** Логика во фронтендах (ветвления, вычисления, данные) приезжает с тестом vitest + testing-library.
- **№3** Файл с двойником во втором фронтенде правится в обоих в одном PR или переезжает в `shared/` (`check-paired-files`). Новый общий код — сразу в `shared/`.
- **№16** Паритет — по роутам бэкенда: роут, доступный не с обеих площадок, — запись в `scripts/feature-parity-baseline.json` (`status`, честная `reason`, `since`) (`check-feature-parity`).
- **Одна механика — один компонент:** перед новым контролом/списком/парсером — grep; дубль — вынос в общий модуль в том же PR.
- **Никаких заглушек вместо данных пользователя:** нет данных → пусто/скелетон/«—», не выдуманное число.
- **Загрузка — скелетон по форме контента** (`schema-miniapp/src/components/Skeleton.tsx`), спиннер — только у кнопок-действий.
- **Полноэкранный лист в webapp** (`position: fixed; inset: 0`) → `const goBack = useHistorySheet(onClose)`, все «Назад/Закрыть» — через `goBack()`; без `history.pushState` (`check-history-sheet`).
- **Мини-апп:** `dist/` коммитится — после правки `schema-miniapp/src` или `shared/` выполни `npm run build --prefix schema-miniapp` и закоммить `schema-miniapp/dist`. Сайт собирает Docker (его dist в git нет). Деплой = push в `main`.

### Фронтенды: очевидность и визуал → [.claude/rules/frontend-visual.md](.claude/rules/frontend-visual.md)
- **Онбординг:** новая фича до первого действия отвечает «откуда это и зачем» прямо на пути пользователя; одно главное действие на экран; тап-цели ≥44×44 (`hitboxStyle`, `check-tap-targets`); раскрытие не только по `:hover` (`check-hover-only-reveal`).
- **Без размытия:** `backdrop-filter` и `filter: blur` запрещены (`check-render-poison`); вместо стекла — сплошной цвет, свечение — градиентом.
- **Цвет — из токенов**, не литералом (`check-color-drift`); прозрачный токен — `color-mix(in srgb, var(--x) N%, transparent)`; `'var(--x)18'` невалидно (`check-var-alpha-suffix`).

### Тексты для пользователя → [.claude/rules/texts.md](.claude/rules/texts.md)
- **ты/вы:** каждая строка с обращением — в обеих формах. Бэк: `t(form, 'ты', 'вы')` (`src/notification/address-form.ts`); фронт: `const tr = useTr(); tr('ты', 'вы')`; контент-файлы — билдер `buildX(tr)` + хук. «Вы»-строка целиком во множественном числе (`check-address-form`, `check-second-person`, `check-address-agreement`).
- **Род:** мужских форм нет — настоящее время, безличный оборот, существительное; скобки «сделал(а)» запрещены (`check-gendered-forms`).
- **№7** Свободный текст от пользователя → кризисная детекция (`crisisMarkers`) на клиенте до шифрования + карточка 8-800-100-49-94 (детская 8-800-2000-122 второй строкой).
- **№12** Голос: без потока «это не X, это Y», канцелярита, метатекста, филлеров ([docs/VOICE.md](docs/VOICE.md), `check-robot-phrases`). Владелец «работает в подходе схема-терапия» — не «схема-терапевт» и не «психолог».
- **№27** Термины схема-терапии — по [docs/TERMINOLOGY.md](docs/TERMINOLOGY.md); режимы с заглавных в обоих словах («Карающий Критик») (`check-schema-terms`).

### Бэкенд: эндпоинты и хосты → [.claude/rules/backend-api.md](.claude/rules/backend-api.md)
- **№5** Бакет rate-limit — только по проверенной подписи (иначе IP). Денежные, заявочные и кодовые ручки — `@PersistentThrottle()` (счётчик в Postgres, общий для инстансов); каждая ручка с `@Throttle` классифицирована (`check-persistent-throttle`).
- **№6** Новый эндпоинт — DTO с class-validator; строковое поле — с верхней границей (`check-body-dto`, `check-dto-string-bounds`).
- **№19** Единственный хост приложения — `schemehappens.ru`; `kotlarewski.gr` отдаёт только визитку (`src/practice-domain.middleware.ts`). Новый хост — запись в `canonical-host.ts` или в middleware + тест; кука шагов OAuth — только через `oauth-host.ts`.

### Безопасность → [.claude/rules/security.md](.claude/rules/security.md)
- Перед правкой auth/api/therapy — [docs/SECURITY.md](docs/SECURITY.md). `ENCRYPTION_KEY` не ротируется без перешифрования; `HEALTHY_ADULT_MAX_TOKEN` подписывает вход MAX. Данные из `callback_data` валидируются; команды с побочным эффектом проверяют `ADMIN_ID`. Env — через `ConfigService`/`process.env`, без хардкода.

### Данные и миграции → [.claude/rules/data.md](.claude/rules/data.md)
- **№4** Два места, обязанные совпадать, фиксируются тестом-сверкой; read-modify-write денормализованного поля — в `$transaction` или пересчётом.
- **№18** Новый сырой SQL — строка в живом спеке `test/raw-sql-live-*.e2e-spec.ts` + запись в `scripts/raw-sql-live-baseline.json` (`check-raw-sql-live`); функция с `void` — через `$executeRaw`.
- **№28** Новый горячий путь — сценарий в `test/perf/scenarios.ts` (`check-query-plans`); индекс — обычный `CREATE INDEX`, не `CONCURRENTLY`.
- **Миграции:** SQL исполнен до коммита (`prisma migrate dev` или `migrate deploy` на чистой БД); сырой `INSERT` заполняет `updatedAt` и все NOT NULL без дефолта; миграция идемпотентна целиком; падение разбирай с ПЕРВОЙ ошибки. Дампы БД в репозиторий — никогда.
- **Новая таблица с `userId`:** `USER_DATA_TABLES` (`src/bot/user-data-tables.ts`) + `USER_OWNED_TABLES` (`src/auth/user-owned-tables.ts`) + `UNIQUE_RULES` (`src/auth/merge.service.ts`), шифрование свободного текста (`EncryptSchema`, реестр `encryption-coverage.spec.ts`), `onDelete: Cascade`, `npx prisma generate`.

### Эксплуатация → [.claude/rules/ops.md](.claude/rules/ops.md)
- **№14** Всё, что исполняется у пользователя, под тестом: `public/**/*.js` упомянут тестом (`check-public-scripts`); тест проходит через шов; имя параметра сверяется целиком (`/(^|[#&])X=/`); экран-тупик шлёт отчёт наверх; сигнализация — с троттлингом.
- **№17** `@Cron` → `CronLeaderService.claimRun(имя, окно)` после дешёвых гардов, окно меньше периода; классификация в `scripts/cron-leader-baseline.json` (`check-cron-leader`).
- **№21** Новая внешняя интеграция = проба в `src/infra/self-check/` (живой вызов, таймаут, не бросает).
- **№22** Новая env-переменная = запись в `src/infra/env-registry*.ts` + строка в `docs/ENV.md` (`check-env-registry`).
- **№23** Парсер ответа внешней площадки — с записанной фикстурой в `test/fixtures/recorded/` (`check-recorded-fixtures`).
- **№24** У каждой джобы есть `timeout-minutes`; открытая issue `ci-alarm` — работа на сейчас.

### Аналитика → [.claude/rules/analytics.md](.claude/rules/analytics.md)
- **№8** User-facing фича = событие: имя в `ANALYTICS_EVENTS` (`src/analytics/analytics.constants.ts`) + ветка в `sanitizeMeta` (только известные поля) + константа на фронте (`shared/src/share/analytics.ts`) + блок в `/stats` (чистый форматтер с тестом, включая пустую БД; язык без терминов).

### Telegram, канал, статьи → [.claude/rules/telegram.md](.claude/rules/telegram.md)
- Хендлеры в `try/catch`; `answerCbQuery()` до БД; ошибки — `this.logger.error`; переходы — `editMessageText`; логика в `bot.service.ts`, UI в `telegram.service.ts`; callback — `действие:параметр`.
- Правка `src/bot/healthy-adult.data.ts` приезжает с миграцией (`check-pool-sync`); бриф канала — `HEALTHY_ADULT.md`; статьи — [docs/ARTICLES.md](docs/ARTICLES.md).

### Тесты → [.claude/rules/tests.md](.claude/rules/tests.md)
- Новая логика приезжает с тестом в том же коммите; пишешь в одном месте, читаешь в другом — тест «сохранил → нашёл»; баг с прода — регрессионный тест.
- Покрытие бэкенда не падает (`check-coverage-ratchet`); новый контроллер = e2e-смок ownership в `test/`; новый e2e-спек = строка в джобе `ci.yml` (`check-e2e-in-ci`); новый гейт = тест в `src/test-support/gates/` (оба исхода).
- **№25** Календарный день `YYYY-MM-DD` = полночь UTC (`shared/src/utils/calendarDate.ts`); `new Date('…T00:00:00')` без `Z` — красный флаг; сьюты гоняются и под `TZ=Australia/Sydney`.
