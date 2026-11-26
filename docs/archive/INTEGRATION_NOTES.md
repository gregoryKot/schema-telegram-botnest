# Интеграция ветки покрытия/безопасности с main

Ветка `claude/project-test-coverage-review-9z7vor` ушла вперёд на ~48
коммитов (тесты, фиксы, security-трипваеры), main — на ~33. Полный merge
даёт **19 конфликтов**. Важно: часть из них — **не** «обе стороны сделали
один фикс», а **разные реализации перекрывающихся фиксов** — их нельзя
свести механически (`--ours`/`--theirs`), нужна семантическая
реконсиляция + подгонка тестов. Ниже — карта решений по каждому файлу.

## Группа A — «наш фикс, которого нет в main» → взять НАШЕ (keep ours в хунке)

Здесь main в конфликтном участке имеет старую версию, а ветка — улучшение.
Разрешать, оставляя нашу сторону; не терять авто-смёрженные правки main
вне маркеров.

- `src/therapy/mode-maps.service.ts` — наша `assertHasClient` в
  get/update/deleteModeMap (фикс доступа после разрыва связи). **Оставить.**
- `src/therapy/mode-maps.controller.ts` — наш маппинг `'No active
  relation' → 403` (4 catch-блока). **Оставить.**
- `src/therapy/therapist-request.service.ts` — наш вызов
  `SecurityLogService` (аудит выдачи роли). Проверить, что main не удалил
  зависимость; **оставить наше**.
- `src/utils/encrypt-migration.ts` — наш `classify()` (защита от двойного
  шифрования) + per-row изоляция. **Оставить наше** (3 хунка).

## Группа B — main переписал ту же область по-своему → РЕКОНСИЛИЯ

Нужно понять обе реализации, выбрать каноничную (обычно main, т.к. туда
уже влит рефакторинг), и **переписать наши тесты под неё**.

- `src/booking/slot.service.ts` — main добавил tz-хелперы
  `pad`/`toDateStr`/`localToUtc`; наш таймзонный фикс — в другом месте
  файла (авто-смёржен). РИСК: двойная коррекция. Решение: взять реализацию
  main как каноничную, прогнать `src/booking/slot.service.spec.ts` против
  неё; если наши ассерты (Москва байт-в-байт, DST) падают — переписать их
  под поведение main, СОХРАНИВ смысл проверок (день недели и дата из одной
  tz; слоты внутри окна).
- `webapp/src/utils/crisisMarkers.ts` (+ парный miniapp) — **SAFETY-
  CRITICAL**. Обе стороны правили сами регэкспы кризис-детекции. НЕЛЬЗЯ
  терять ни один из 7 наших фиксов (выброшусь/повешусь/порежу вены/
  покончила/слитно/гомоглифы/выпилиться) И правки main. Свести
  ОБЪЕДИНЕНИЕ паттернов, прогнать оба corpus-теста
  (`crisisMarkers.test.ts` наш расширенный + main), пересобрать miniapp
  dist, сверить парность (`check-paired-files.mjs`). Ревью глазами.
- `src/auth/auth.controller.ts` — main тяжело менял (OAuth/cookie), наш
  вклад — `TwoFaCodeDto` на 2FA-эндпоинтах. Наложить наш DTO-фикс поверх
  версии main; прогнать `test/auth-flows.e2e-spec.ts`.

## Группа C — add/add тесты (оба создали файл)

Сверить содержимое, взять ОБЪЕДИНЕНИЕ кейсов (или более полный):
- `src/therapy/therapist-request.service.spec.ts`
- `src/therapy/therapy-client-data.service.spec.ts`
- `webapp/src/utils/format.test.ts`
- `schema-miniapp/src/hooks/useSheets.test.ts`
- `src/bot/bot.analytics.overview.spec.ts` (оба чинили флейк — взять
  fake-timers версию, слить кейсы).

## Группа D — механические

- `eslint.config.mjs` — объединить glob'ы тест-файлов: наши
  `**/*.e2e-spec.ts` + `test/e2e-support/**/*.ts` И правила main
  (no-unused-vars, no-misused-promises, доп. ignores). Union.
- `schema-miniapp/package.json` + `package-lock.json` — слить наши
  devDeps (vitest/jsdom/testing-library) с изменениями main.
- `schema-miniapp/dist/**` — сборочный вывод: после merge
  `npm run build --prefix schema-miniapp`, закоммитить.
- `scripts/eslint-baseline.json` — после сведения: пересчитать
  `node scripts/check-eslint-ratchet.mjs --update` (только вниз).
- `scripts/coverage-baseline.json` (если конфликт) —
  `node scripts/check-coverage-ratchet.mjs --update`.

## Гейт приёмки merge (всё зелёное, иначе не мержить — правило №1)

```
npx jest --silent && npm run test:e2e
npm test --prefix webapp && npm test --prefix schema-miniapp
npx tsc --noEmit -p tsconfig.build.json
node scripts/check-eslint-ratchet.mjs
node scripts/check-coverage-ratchet.mjs
node scripts/check-paired-files.mjs && node scripts/check-address-form.mjs
```

## Почему merge не сделан в этой сессии

Реконсиляция группы B — safety-критичный код (кризис-детекция, tz-логика
слотов, auth-флоу), где ошибка = пропуск кризиса / дыра авторизации /
неверная запись. Делать её вслепую соло, в гонке с движущимся main и без
возможности параллельно верифицировать — риск ровно тех регрессий, что
вся работа предотвращала. Безопаснее: провести merge отдельным
сфокусированным шагом (в идеале — когда main стабилизируется), сверяясь с
этой картой и полным гейтом выше.
EOF
