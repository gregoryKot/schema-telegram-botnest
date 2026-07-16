# План полного тестового покрытия (ревью 2026-07-16)

## Текущее состояние

| Пакет | Тестов | Покрытие строк |
|---|---|---|
| Бэкенд (jest) | 43 файла / 353 теста | **23%** (ветки 18%) |
| webapp (vitest) | 5 файлов / 64 теста | coverage не настроен (~5 из ~20 логических файлов) |
| schema-miniapp | **0** | 0% (частично спасает `check-paired-files.mjs`) |
| e2e | мёртвый скаффолд `test/app.e2e-spec.ts`, в CI не гоняется | — |

По модулям бэкенда: notification 82%, donation 57%, subscription 50%, bot 34%,
booking 27%, api 18%, therapy 17%, telegram 12%, **auth 7%** (3630 строк —
крупнейший и самый критичный модуль).

**Качество существующих тестов высокое** (регрессии на инциденты,
read-after-write, stateful-фейки, точные ассерты) — проблема не в качестве,
а в том, что покрытие сконцентрировано в «спокойных» зонах, а
аутентификация / шифрование / HTTP-слой почти не покрыты.

## Принцип

Не «100% везде», а: (1) сначала зоны, где баг = катастрофа — утечка данных,
потеря данных, деньги, обход auth; (2) потом инварианты и хендлеры;
(3) храповик покрытия, чтобы достигнутое не откатывалось.
Цель: **~60–70% строк бэкенда при 90%+ в auth/crypto/guards/payments** + e2e-смоки.

## Этап 1 — критический контур (✅ = сделано в этом PR)

1. ✅ `src/utils/crypto.spec.ts` — roundtrip AES-256-GCM, multi-key fallback
   (ротация ENCRYPTION_KEY), tamper-детекция + алерт, encryptRecord/decryptRecord.
2. ✅ `src/api/telegram-auth.guard.spec.ts` — оба пути аутентификации API:
   подпись initData (пересчитана в тесте независимо), forged hash + алерт
   админу, просроченный auth_date, канонический userId через AuthProvider,
   SKIP_AUTH жёстко выключен в production.
3. ✅ `src/auth/jwt.guard.spec.ts` — JwtAuthGuard/OptionalJwtGuard: подпись,
   тип токена (access/refresh/link не взаимозаменяемы), срок, issuer,
   link_token из cookie/query.
4. ✅ `src/utils/encrypt-migration.spec.ts` — миграция плейнтекста на фейковой
   таблице; найден и зафиксирован тестом баг двойного шифрования (если
   ENCRYPTION_KEY_OLD убран до rotate-encryption — оригинал невосстановим).
   Фикс бага — отдельным решением.
5. ✅ `src/auth/auth.service.spec.ts` — ротация refresh-токенов (reuse палит
   всю family), verifyTelegramWebAppData (malformed hash → 401, не 500),
   findOrCreateUserByProvider, merge-токены.
6. ✅ (частично) `src/auth/totp.service.spec.ts` + `providers/telegram.provider.spec.ts`.
   Осталось: google/vk/telegram-oidc провайдеры (google.provider тянет
   ESM-only `jose` — jest-конфигу нужен transform для node_modules).
   Известное ограничение: verifyCode принимает тот же TOTP-код повторно
   в пределах окна (одноразовы только recovery-коды) — решить осознанно.
7. ☐ **Smoke-e2e** (`@nestjs/testing` + supertest уже в devDeps): глобальный
   `ValidationPipe` реально стрипает лишние поля; guard висит на API;
   ownership «юзер А не видит данные юзера Б» на 2–3 эндпоинтах;
   `payment.controller` идемпотентен и отвечает шлюзу `OK`.
   Отдельная CI-джоба рядом с `migrations` (Postgres уже поднимается).

## Этап 2 — фронтенды и safety

8. ✅ Кризисная детекция: корпус 24 → 52 теста (+ветки регэкспов, негативные,
   блок «известные ограничения»). Подтверждены ОПАСНЫЕ пропуски — «выброшусь
   из окна», «повешусь», «порежу вены» (1-е лицо буд. времени; ветки
   «повеслюсь»/«порезжу» — несуществующие формы), «покончила с собой»;
   ложное срабатывание «фильм про суицид». **Нужен фикс crisisMarkers.ts
   в обоих фронтендах + пересборка dist — отдельным решением.**
9. ✅ (первый шаг) Бутстрап miniapp: vitest+jsdom+testing-library, `"test"`
   в package.json, шаг в CI-джобе `miniapp`; 26 тестов —
   `useTelegramBackButton` (приоритетная цепочка Back), `useSheets`.
   Осталось: смок `api.ts` (603 строки, разошёлся с webapp); стратегически —
   shared-пакет для парных файлов.
10. ✅ (частично) webapp: `api.test.ts` (24 — зафиксировано: reactive-refresh
    на 401 НЕТ, только проактивный таймер AuthContext; single-flight нет),
    `useHistorySheet` (8 — вектор двойного onClose при нарушении конвенции),
    `addressForm` (17 — дефолт null→'ты' даже без провайдера).
    Осталось: `AuthContext.tsx`, `@vitest/coverage-v8` + test-секция в
    vite.config.

## Этап 3 — сервисы и хендлеры

11. ☐ `therapy-client-data.service.ts` (границы доступа терапевт↔клиент),
    `therapist-request.service.ts` (выдача роли), `diary.service.ts`
    (read-after-write шифрованного дневника), `payment.controller.ts`.
12. ☐ `telegram.service.ts`: инвариант «answerCbQuery до БД» + try/catch —
    дёшево фиксируется grep-трипваером по образцу `table-registry.spec.ts`.
13. ☐ Починка слабостей существующих тестов:
    - `merge.service.spec.ts:80` — тест-пустышка (имя обещает `<>`, ассертит
      только `toBeDefined`);
    - `telegram.pair-notify.spec.ts` и `bot.analytics.overview.spec.ts` —
      реальный `new Date()` (флейк около полуночи МСК) → fake timers;
    - webapp `useYsqTest.test.ts` — `wait(250)` → fake timers;
    - зеркальный `notification.service.spec.ts` (переписывает where-клаузу
      сервиса в ассертах) → stateful-фейк;
    - CLAUDE.md ссылается на несуществующий `bot.schema-note.service.spec.ts`
      (переименован в `notes.service.spec.ts`).

## Этап 4 — механизм принуждения (без него откатится)

14. ☐ **Coverage-храповик** по образцу eslint-храповика: бейслайн текущего
    покрытия в `scripts/`, джоба падает при снижении; порог поднимается
    по мере этапов 1–3. Отдельный жёсткий порог 90%+ на `src/auth`,
    `src/utils/crypto*`, guards — после этапа 1.
15. ☐ Правило в CLAUDE.md: новый контроллер = e2e-смок на ownership.

## Известные ограничения текущего сьюта (осознанно принятые)

- Prisma-моки рукописные `as any` — переименование поля в схеме юниты не
  заметят; страховка — `tsc` по прод-коду и CI-джоба `migrations`.
- DTO-спеки зовут `validate()` руками — проводку глобального ValidationPipe
  закроет e2e-смок (п. 7).
- Кризисной детекции на сервере нет и не будет (текст шифруется до
  отправки) — поэтому клиентский тест обязан быть исчерпывающим (п. 8).
