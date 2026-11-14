# Карта: гейты CI и команды

> Красный CI — найди гейт в таблице: что ловит, где бейслайн, есть ли `--update`, в какой
> джобе. Сам скрипт открывай, только если таблицы мало: у каждого гейта в шапке — история
> и как чинить. Подробности к [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

Все быстрые гейты разом, как в CI, — `node scripts/agent/precheck.mjs` перед пушем: список берётся из `.github/workflows/ci.yml`, прогон идёт в чистом worktree (HEAD плюс то, что попадёт в коммит), печатается только красное. Гейты с coverage, сборкой, eslint и БД пропускаются (`--list` покажет какие) — их проверит CI.

### Гейты CI

Бейслайн указан полным путём, «—» значит, что бейслайна нет. «--update: нет» значит, что флага нет: это ручная классификация с причинами или жёсткий запрет без долга.

| скрипт | что ловит | baseline | --update? | джоба CI |
|---|---|---|---|---|
| check-address-agreement.mjs | «вы» с глаголом в единственном числе мужского рода | — | нет | webapp |
| check-address-form.mjs | жёсткие «ты»-строки вне tr()/t()/pickForm() во фронтендах | `scripts/address-form-baseline.json` | да | webapp |
| check-agent-docs.mjs | бюджет CLAUDE.md и правил, битые ссылки, модуль или гейт без строки в карте | — | нет | checks |
| check-alert-throttle.mjs | прямой `notifyAdminWithFallback` без бюджета и записи в baseline | `scripts/alert-throttle-baseline.json` | да | checks |
| check-body-dto.mjs | `@Body()` с interface/type вместо DTO-класса с class-validator | `scripts/body-dto-baseline.json` | да | checks |
| check-body-truncation.mjs | `.slice(0, …)` в контроллерах молча режет поля запроса | `scripts/body-truncation-baseline.json` | нет | checks |
| check-bundle-size-ratchet.mjs | рост байт JS-бандлов webapp | `scripts/bundle-size-baseline.json` | да | webapp |
| check-capability-registry.mjs | ветка `if (!env) return` без регистрации в capability-report | `scripts/capability-registry-baseline.json` | да | checks |
| check-color-drift.mjs | захардкоженные хроматические hex/rgb вне токенов палитры | `scripts/color-drift-baseline.json` | да | webapp |
| check-coverage-ratchet.mjs | покрытие бэкенда ниже фиксированного пола, общего и по каталогам (сам гоняет jest --coverage); пол меняет владелец правкой файла | `scripts/coverage-baseline.json` | нет | backend |
| check-cron-leader.mjs | `@Cron` без классификации leader-election (двойной запуск); метод, до которого через `this.x()` доходят два leader-крона, без записи `shared` с причиной (правила разбора — `check-cron-leader-rules.mjs`) | `scripts/cron-leader-baseline.json` | нет | checks |
| check-css-link-order.mjs | порядок `<link rel="stylesheet">` в собранном `webapp/dist/index.html` сменился (CSS переехал в другой чанк) | `scripts/css-link-order.json` | да | webapp |
| check-dead-end-report.mjs | catch-ветка `webapp/src/pages/**`, `webapp/src/components/*/**` с исходом-ошибкой (`set…Error/Fail…(`, `setX('error')`) без классификации: `reports` (отчёт в catch или хук `via`), `exempt`/`debt` с причиной | `scripts/dead-end-report-baseline.json` | нет | checks |
| check-dead-files.mjs | файл без нетестовых потребителей (мёртвый код) | `scripts/dead-files-baseline.json` | да | checks |
| check-deploy-lag.mjs | образ на проде старее последнего коммита main | — | нет | prod-smoke |
| check-deploy-paths.mjs | рассинхрон путей Dockerfile, .dockerignore, amvera.yml | — | нет | checks |
| check-doc-refs.mjs | путь в обратных кавычках `CLAUDE.md`, `docs/SECURITY.md`, `docs/README.md`, `.claude/rules/*.md`, карты (`docs/ARCHITECTURE.md`, `docs/architecture/*.md`) и реестра `docs/open/*.md`, которого нет в дереве (маски и блоки кода не сверяются) | `scripts/doc-refs-baseline.json` | нет | checks |
| check-dto-string-bounds.mjs | строковое поле DTO без верхней границы длины | `scripts/dto-string-bounds-baseline.json` | нет | checks |
| check-e2e-in-ci.mjs | `test/*.e2e-spec.ts`, который не запускается ни одним шагом workflow | — | нет | checks |
| check-e2e-stop-cron.mjs | тест поднимает AppModule без `stopCronJobs(app)` после `app.init()` — настоящие `@Cron` тикают посреди спека | — | нет | checks |
| check-env-registry.mjs | чтение env мимо реестра и протухшие записи реестра | — (реестр `src/infra/env-registry.entries*.ts`) | нет | checks |
| check-ephemeral-port.mjs | спек занимает эфемерный порт и отпускает его, чтобы забиндить позже: `.listen(0…)` и `.close(` в одной функции (разбор — `ephemeral-port-scan.mjs`) вне `src/test-support/ephemeral-port.ts`; поднят в beforeAll и закрыт в afterAll — законно | — | нет | checks |
| check-eslint-ratchet.mjs | рост числа ошибок и варнингов eslint; полный режим — по каталогам верхнего уровня отдельными процессами (правила — `eslint-ratchet-rules.mjs`), локально `--changed` — только файлы против `origin/main` | `scripts/eslint-baseline.json` | да | eslint |
| check-file-size-ratchet.mjs | рост файла из baseline, новый файл больше 300 строк | `scripts/file-size-baseline.json` | да | backend |
| check-filename-case.mjs | два отслеживаемых пути, различающиеся только регистром (`diagramEdges.ts` ≈ `DiagramEdges.tsx`): на macOS Vite резолвит не тот файл | — | нет | checks |
| check-frontend-coverage-ratchet.mjs | покрытие webapp, shared (`--package`) ниже фиксированного пола; пол меняет владелец правкой файла | `scripts/frontend-coverage-baseline.json` | нет | webapp, shared |
| check-gate-exemptions.mjs | ALLOW/EXCLUDE-списки гейтов без теста-образца | — | нет | checks |
| check-gendered-forms.mjs | мужской род в тексте для пользователя («ты сделал»; без «ты» — по паре `tr(ты, вы)`, «Сказал» ↔ «Сказали») | `scripts/gendered-forms-baseline.json` | да | backend |
| check-glyph-controls.mjs | `<button>`, `<a>`, элемент с control-ролью или `{...pressable()}` без `aria-label`/`aria-labelledby`, чьё содержимое — только глиф, иконка или пусто | — | нет | webapp |
| check-history-sheet.mjs | fullscreen-оверлей (инлайн, CSS-класс или тег рамки `<ExScreen`/`<BottomSheetShell`) без `useHistorySheet(` в своём компоненте (кнопка «Назад»); запись бейслайна — на файл, несколько компонентов без хука — поле `components` | `scripts/history-sheet-baseline.json` | нет | webapp |
| check-hover-only-reveal.mjs | элемент раскрывается только по :hover, без пути для пальца или клавиатуры; раскрытие засчитывается, только если выигрывает каскад; .css и `<style>` в .tsx | — | нет | webapp |
| check-ignored-tracked.mjs | отслеживаемый git-файл, запрещённый .gitignore | — | нет | checks |
| check-incident-registry.mjs | закрытая issue `ci-alarm` с напоминанием бота без строки в `docs/INCIDENTS.md` (номер issue и дата в её окне ±1 день); ходит в GitHub API, код 2 — GitHub не ответил | `scripts/incident-registry-baseline.json` | нет | nightly |
| check-jscpd-ratchet.mjs | рост копипасты от 70 токенов (jscpd) | `scripts/jscpd-baseline.json` | да | backend |
| check-local-cache-writers.mjs | второй писатель ключа localStorage, ключ без классификации владельца (mirror/local), протухшая запись | `scripts/local-cache-baseline.json` | нет | checks |
| check-legacy-name.mjs | возврат старого названия «СхемаЛаб» в текстах | — | нет | checks |
| check-live-ruleset.mjs | живой ruleset `main` и настройки слияния разошлись с копией `.github/rulesets/main.json`: enforcement, правила, `strict`, набор обязательных проверок, `allow_auto_merge`, `allow_squash_merge`, `delete_branch_on_merge`; не ответил публичный `/rules/branches/main` — красное; поле, которого API не отдал (права токена), или не ответившие `/rulesets`, `/repos` — `::warning::не проверено`, шаг зелёный | — | нет | nightly (`live-ruleset`) |
| check-mutation-ratchet.mjs | падение mutation-score золотых зон (читает отчёт Stryker) | `scripts/mutation-baseline.json`; для nightly-волн через `--baseline=`: `scripts/mutation-golden-auth-baseline.json`, `scripts/mutation-golden-payments-baseline.json`, `scripts/mutation-crisis-baseline.json`, `scripts/mutation-outbox-baseline.json`; `--partial` (PR-CI `mutation-changed`) сверяет только файлы отчёта | да | nightly, PR-CI |
| check-mutation-zone.mjs | файл, выделенный из мутационной зоны (импортёров из зоны не меньше, чем вне), выпал из неё молча | `scripts/mutation-zone-baseline.json` | нет | checks |
| check-next-session-reads.mjs | чтение `.nextSession` во фронтах мимо `upcomingSession(…)` (настенная дата стареет, класс 17 INCIDENTS); исключение — форма правки `useSessionAliasEditing.ts` | — | нет | checks |
| check-persistent-throttle.mjs | ручка с лимитом без решения о `@PersistentThrottle()` | `scripts/persistent-throttle-baseline.json` | нет | checks |
| check-pool-sync.mjs | фразы `healthy-adult.data.ts`, не доехавшие миграциями до БД | — | нет | checks |
| check-pr-size.mjs | PR больше 60 файлов или 1500 изменённых строк (дифф `origin/main...HEAD`; не считаются `*-baseline.json`, `package-lock.json`, `test/fixtures/**`, чистые переименования); обход — метка PR `big-pr`; только событие `pull_request`, в precheck пропускается | — | нет | checks |
| check-public-scripts.mjs | `public/**/*.js` без теста, инлайн-`<script>` без хеша | `scripts/public-scripts-baseline.json` | да | checks |
| check-query-plans.mjs | Seq Scan и рост страниц в EXPLAIN горячих запросов | `scripts/query-plan-baseline.json` | да | perf |
| check-raw-sql-live.mjs | файл с `$queryRaw`/`$executeRaw` без спека на живом Postgres | `scripts/raw-sql-live-baseline.json` | нет | checks |
| check-recorded-fixtures.mjs | парсер внешнего формата без записанной фикстуры | `scripts/recorded-fixtures-baseline.json` | нет | checks |
| check-render-poison.mjs | `backdrop-filter` и `blur` во фронтендах (тормоза WebKit PWA) | `scripts/render-poison-baseline.json` | да | webapp |
| check-robot-phrases.mjs | роботные конструкции («Это не X. Это Y»), канцелярит | `scripts/robot-phrases-baseline.json` | да | backend |
| check-route-collisions.mjs | один HTTP-маршрут в двух контроллерах | — | нет | checks |
| check-scale-drift.mjs | инлайн borderRadius/padding вне шкалы токенов | `scripts/scale-drift-baseline.json` | да | webapp |
| check-schema-terms.mjs | неканонические термины схема-терапии в текстах | — | нет | checks |
| check-second-person.mjs | захардкоженные императивы и «вы»-формы вне tr(), тексты бэкенда | `scripts/second-person-baseline.json` | да | webapp |
| check-silent-catch.mjs | `.catch(() => {})`, глушащий ошибку сети | `scripts/silent-catch-baseline.json` | да | backend |
| check-spelling.mjs | орфография видимых строк («оффлайн» → «офлайн», три точки после буквы → «…»; игру правило многоточия пропускает); комментарии и тесты не смотрит | — | нет | checks |
| check-tap-targets.mjs | интерактивный элемент, у которого обе стороны меньше 44px — инлайн-размер или CSS-класс (с зоной `::before` отрицательным inset; `tap-targets-css.mjs`) | `scripts/tap-targets-baseline.json` | да | webapp |
| check-utility-inline.mjs | инлайновый `style={{…}}`, набор которого точно совпадает с классом-утилитой `shared/src/theme/utilities.css` | `scripts/utility-inline-baseline.json` | да | webapp |
| check-telegram-chat-id.mjs | отправка в Telegram (`sendMessage`/`sendTg`/`sendBounded`/`chat_id:`) по адресу, приведённому из `userId`/`user.id`, вне `src/auth/telegram-identity.ts` и `src/bot/account.service.ts` (класс #456) | — | нет | checks |
| check-timer-cleanup.mjs | файл `webapp/src`, `shared/src` с `setTimeout(() => setX…)` без `clearTimeout` и `useTimedFlag` (таймер переживает jsdom) | `scripts/timer-cleanup-baseline.json` | нет | checks |
| check-tiny-fonts.mjs | инлайн `fontSize` ниже 11px | `scripts/tiny-fonts-baseline.json` | да | webapp |
| check-token-contract.mjs | расхождение набора токенов `shared/src/theme/tokens.css` и `webapp/src/index.css` | — | нет | webapp |
| check-unwatched-code.mjs | исполняемый .js/.mjs/.cjs/.sh вне тестов и наблюдаемых деревьев | `scripts/unwatched-code-baseline.json` | да | checks |
| check-var-alpha-suffix.mjs | hex-суффикс альфы после `var()`, например `var(--x)18` | — | нет | webapp |
| check-weak-assert-ratchet.mjs | тесты только с голым `toHaveBeenCalled()` без аргументов | `scripts/weak-assert-baseline.json` | да | backend |
| check-webvisor-fields.mjs | текстовое поле визитки без метки `ym-disable-keys` | — | нет | webapp |
| check-zero-coverage.mjs | файл `src/**` с 0% строк вне бейслайна (читает `coverage/coverage-summary.json` шага `check-coverage-ratchet`); `*.module.ts` и `src/main.ts` не считаются; покрытый файл из бейслайна — предупреждение «зафиксируй `--update`», не красное | `scripts/zero-coverage-baseline.json` | да (только вычёркивает) | backend |
| setup-merge-drivers.mjs --check | merge-драйвер или baseline без строки/скрипта в .gitattributes. Режим слияния бейслайна — строка `.gitattributes`: `ratchet-sum` (счётчики: база + обе дельты), `ratchet-min`, `ratchet-max`; исключения по ключу — `scripts/merge-json-ratchet-rules.mjs`; база для ветки поверх влитой squash-ветки — `scripts/merge-json-ratchet-history.mjs` | — | нет (`--check` ничего не ставит) | checks |
| git-hooks/commit-msg (локально, не CI) | у коммита есть тело, заголовок длиннее 120 знаков или трейлеров больше четырёх; `Merge …`/`Revert …` от git проходят | — | нет | — (тест: `src/test-support/gates/commit-msg-hook.spec.ts`, джоба backend) |
| git-hooks/pre-push (локально, не CI) | красная сборка `webapp` перед `git push` (`tsc -b && vite build` с `VITE_BOT_USERNAME`); ставится в `core.hooksPath` скриптом `setup-git-hooks.mjs` из npm `prepare`, работает из git worktree; `--no-verify` не используется | — | нет | — (тест: `src/test-support/gates/git-hooks.spec.ts`, джоба backend) |

### Команды

```bash
npx tsc --noEmit -p tsconfig.build.json            # типы бэкенда (то же в CI)
npx jest                                           # юнит-тесты; один файл: npx jest src/путь/x.spec.ts
npm run test:cov                                   # jest --coverage; гейт: node scripts/check-coverage-ratchet.mjs
npx eslint src --quiet                             # быстрый линт (README); npm run lint запускает eslint с --fix
node scripts/check-eslint-ratchet.mjs              # eslint-храповик, полный (нужен npm ci во всех пакетах + prisma generate; ~4 мин)
node scripts/check-eslint-ratchet.mjs --changed    # то же по файлам, отличающимся от origin/main (секунды; любая находка — красное)
npm run build                                      # nest build; npm run start:dev — бэкенд с watch
npm run build --prefix webapp                      # tsc -b && vite build (в прод-сборке нужен VITE_BOT_USERNAME)
npm test --prefix webapp                           # vitest run; так же --prefix shared
npm run test:e2e                                   # jest --config ./test/jest-e2e.json (часть спеков требует E2E_REAL_DB=1 и DATABASE_URL)
npx prisma generate                                # после любых правок schema.prisma
npx prisma migrate dev                             # создать миграцию на dev-БД
npx prisma migrate deploy                          # применить миграции (в CI на пустой БД, дважды)
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code   # дрейф схемы и миграций
npm run smoke                                      # playwright test (сначала собрать webapp); без WebKit — npx playwright test --project=webapp
node scripts/check-<имя>.mjs [--update]            # любой гейт; --update только если флаг есть в таблице выше
```
