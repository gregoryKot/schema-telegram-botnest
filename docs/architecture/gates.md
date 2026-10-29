# Карта: гейты CI и команды

> Красный CI — найди гейт в таблице: что ловит, где бейслайн, есть ли `--update`, в какой
> джобе. Сам скрипт открывай, только если таблицы мало: у каждого гейта в шапке — история
> и как чинить. Подробности к [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

Все быстрые гейты разом, как в CI, — `node scripts/agent/precheck.mjs` перед пушем: список берётся из `.github/workflows/ci.yml`, прогон идёт в чистом worktree (HEAD плюс то, что попадёт в коммит), печатается только красное. Гейты с coverage, сборкой, eslint и БД пропускаются (`--list` покажет какие) — их проверит CI.

### Гейты CI

Бейслайн указан полным путём, «—» значит, что бейслайна нет. «--update: нет» значит, что флага нет: это ручная классификация с причинами или жёсткий запрет без долга. `check-db-phrases.ts` в CI не гоняется: он ходит в БД, запускать вручную через `npm run check-phrases`.

| скрипт | что ловит | baseline | --update? | джоба CI |
|---|---|---|---|---|
| check-address-agreement.mjs | «вы» с глаголом в единственном числе мужского рода | — | нет | webapp |
| check-address-form.mjs | жёсткие «ты»-строки вне tr()/t()/pickForm() во фронтендах | `scripts/address-form-baseline.json` | да | webapp |
| check-agent-docs.mjs | бюджет CLAUDE.md и правил, битые ссылки, модуль или гейт без строки в карте | — | нет | checks |
| check-alert-throttle.mjs | прямой `notifyAdminWithFallback` без бюджета и записи в baseline | `scripts/alert-throttle-baseline.json` | да | checks |
| check-body-dto.mjs | `@Body()` с interface/type вместо DTO-класса с class-validator | `scripts/body-dto-baseline.json` | да | checks |
| check-body-truncation.mjs | `.slice(0, …)` в контроллерах молча режет поля запроса | `scripts/body-truncation-baseline.json` | нет | checks |
| check-bundle-size-ratchet.mjs | рост байт JS-бандлов webapp и мини-аппа | `scripts/bundle-size-baseline.json` | да | webapp |
| check-capability-registry.mjs | ветка `if (!env) return` без регистрации в capability-report | `scripts/capability-registry-baseline.json` | да | checks |
| check-color-drift.mjs | захардкоженные хроматические hex/rgb вне токенов палитры | `scripts/color-drift-baseline.json` | да | webapp |
| check-coverage-ratchet.mjs | просадка покрытия бэкенда (сам гоняет jest --coverage) | `scripts/coverage-baseline.json` | да | backend |
| check-cron-leader.mjs | `@Cron` без классификации leader-election (двойной запуск) | `scripts/cron-leader-baseline.json` | нет | checks |
| check-db-phrases.ts | мужской род и брак в пуле фраз «ЗВ» в БД | — | нет | — |
| check-dead-files.mjs | файл без нетестовых потребителей (мёртвый код) | `scripts/dead-files-baseline.json` | да | checks |
| check-deploy-lag.mjs | образ на проде старее последнего коммита main | — | нет | prod-smoke |
| check-deploy-paths.mjs | рассинхрон путей Dockerfile, .dockerignore, app.module, amvera.yml | — | нет | checks |
| check-dto-string-bounds.mjs | строковое поле DTO без верхней границы длины | `scripts/dto-string-bounds-baseline.json` | нет | checks |
| check-e2e-in-ci.mjs | `test/*.e2e-spec.ts`, который не запускается ни одним шагом workflow | — | нет | checks |
| check-env-registry.mjs | чтение env мимо реестра и протухшие записи реестра | — (реестр `src/infra/env-registry.entries*.ts`) | нет | checks |
| check-eslint-ratchet.mjs | рост числа ошибок и варнингов eslint; полный режим — по каталогам верхнего уровня отдельными процессами (правила — `eslint-ratchet-rules.mjs`), локально `--changed` — только файлы против `origin/main` | `scripts/eslint-baseline.json` | да | eslint |
| check-feature-parity.mjs | роут бэкенда, вызываемый только одним фронтендом | `scripts/feature-parity-baseline.json` | да | checks |
| check-file-size-ratchet.mjs | рост файла из baseline, новый файл больше 300 строк | `scripts/file-size-baseline.json` | да | backend |
| check-frontend-coverage-ratchet.mjs | просадка покрытия webapp, schema-miniapp, shared (`--package`) | `scripts/frontend-coverage-baseline.json` | да | webapp, shared, miniapp |
| check-gate-exemptions.mjs | ALLOW/EXCLUDE-списки гейтов без теста-образца | — | нет | checks |
| check-gendered-forms.mjs | мужской род в тексте для пользователя («ты сделал») | `scripts/gendered-forms-baseline.json` | да | backend |
| check-glyph-controls.mjs | `<button>`, `<a>`, элемент с control-ролью или `{...pressable()}` без `aria-label`/`aria-labelledby`, чьё содержимое — только глиф, иконка или пусто | — | нет | webapp |
| check-history-sheet.mjs | fullscreen-оверлей без `useHistorySheet(` (кнопка «Назад») | `scripts/history-sheet-baseline.json` | нет | webapp |
| check-hover-only-reveal.mjs | элемент раскрывается только по :hover, без пути для пальца | — | нет | webapp |
| check-ignored-tracked.mjs | отслеживаемый git-файл, запрещённый .gitignore | — | нет | checks |
| check-jscpd-ratchet.mjs | рост копипасты от 70 токенов (jscpd) | `scripts/jscpd-baseline.json` | да | backend |
| check-legacy-name.mjs | возврат старого названия «СхемаЛаб» в текстах | — | нет | checks |
| check-mutation-ratchet.mjs | падение mutation-score золотых зон (читает отчёт Stryker) | `scripts/mutation-baseline.json`; для nightly-волн через `--baseline=`: `scripts/mutation-golden-auth-baseline.json`, `scripts/mutation-golden-payments-baseline.json`, `scripts/mutation-crisis-baseline.json`, `scripts/mutation-outbox-baseline.json` | да | nightly |
| check-mutation-zone.mjs | файл, выделенный из мутационной зоны, выпал из неё молча | `scripts/mutation-zone-baseline.json` | нет | checks |
| check-paired-files.mjs | расхождение парных файлов webapp и schema-miniapp | — | нет | webapp |
| check-persistent-throttle.mjs | ручка с лимитом без решения о `@PersistentThrottle()` | `scripts/persistent-throttle-baseline.json` | нет | checks |
| check-pool-sync.mjs | фразы `healthy-adult.data.ts`, не доехавшие миграциями до БД | — | нет | checks |
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
| check-tap-targets.mjs | интерактивный элемент с инлайн-размером обеих сторон меньше 44px | `scripts/tap-targets-baseline.json` | да | webapp |
| check-tiny-fonts.mjs | инлайн `fontSize` ниже 11px | `scripts/tiny-fonts-baseline.json` | да | webapp |
| check-token-contract.mjs | расхождение дизайн-токенов webapp и мини-аппа (`tokens.css`) | — | нет | webapp |
| check-unwatched-code.mjs | исполняемый .js/.mjs/.cjs/.sh вне тестов и наблюдаемых деревьев | `scripts/unwatched-code-baseline.json` | да | checks |
| check-var-alpha-suffix.mjs | hex-суффикс альфы после `var()`, например `var(--x)18` | — | нет | webapp |
| check-weak-assert-ratchet.mjs | тесты только с голым `toHaveBeenCalled()` без аргументов | `scripts/weak-assert-baseline.json` | да | backend |
| check-webvisor-fields.mjs | текстовое поле визитки без метки `ym-disable-keys` | — | нет | webapp |
| setup-merge-drivers.mjs --check | merge-драйвер или baseline без строки/скрипта в .gitattributes | — | нет (`--check` ничего не ставит) | checks |

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
npm run typecheck --prefix schema-miniapp          # tsc --noEmit -p tsconfig.typecheck.json
npm run build --prefix schema-miniapp              # после правок мини-аппа обязательно закоммитить schema-miniapp/dist
npm test --prefix webapp                           # vitest run; так же --prefix schema-miniapp и --prefix shared
npm run test:e2e                                   # jest --config ./test/jest-e2e.json (часть спеков требует E2E_REAL_DB=1 и DATABASE_URL)
npx prisma generate                                # после любых правок schema.prisma
npx prisma migrate dev                             # создать миграцию на dev-БД
npx prisma migrate deploy                          # применить миграции (в CI на пустой БД, дважды)
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code   # дрейф схемы и миграций
npm run smoke                                      # playwright test (сначала собрать webapp)
node scripts/check-<имя>.mjs [--update]            # любой гейт; --update только если флаг есть в таблице выше
```
