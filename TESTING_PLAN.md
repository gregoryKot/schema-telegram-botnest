# Мастер-план покрытия тестами

Цель — **каждая строчка логики под тестом** во всех трёх частях проекта: бэкенд (NestJS),
миниапп (Vitest) и webapp. Достигаем не разом, а волнами по приоритету **риска**.

Этот файл — живой бэклог тестера. Отмечай `[x]` по мере закрытия. Правила написания
тестов — в `CLAUDE.md` (бэк), `schema-miniapp/TESTING.md` (фронт).

## Текущее состояние (старт, 2026-06-08)

| Часть | Раннер | Файлов логики | Покрыто | Дыра |
|-------|--------|--------------:|--------:|------|
| Бэкенд `src/` | Jest ✅ | ~49 | 3 спека | auth, crypto, merge, therapy — **0** |
| Миниапп `schema-miniapp/` | Vitest ✅ | ~55 | 3 утилиты | api, хуки, компоненты |
| Webapp `webapp/` | ❌ нет | ~70 | 0 | **всё + нет инфры** |

## Принцип приоритизации

Сортируем по `риск × вероятность бага × дешевизна теста`:

- **P0 — Безопасность и целостность данных.** Баг = утечка, чужие данные, потеря/порча зашифрованного. Тестируем первым, с негативными кейсами.
- **P1 — Ядро бизнес-логики + чистые функции.** Оценки, потребности, удаление аккаунта, шифрование-утилиты, форматтеры. Дёшево и часто меняется.
- **P2 — API-слой (контроллеры + клиенты).** Контракты запрос/ответ, авторизация на эндпоинтах, обработка ошибок.
- **P3 — Компоненты и UI-логика.** Поведение глазами пользователя, по убыванию риска фичи.
- **P4 — E2E smoke.** Сквозные критические сценарии.

---

# ВОЛНА 0 — Инфраструктура (разблокирует остальное)

- [x] **Webapp: поднять Vitest** ✅ — Vitest 4 (под Vite 8), jsdom, `src/test/setup.ts` (jest-dom, cleanup, mock matchMedia + `setMatchMedia`), скрипты, `coverage` в gitignore, тесты исключены из прод-`tsc -b`. 28 тестов зелёные.
  - [ ] `webapp/TESTING.md` (раздел про роутер) — осталось
- [ ] **Бэкенд: включить порог покрытия** в jest-конфиге (`coverageThreshold`) по политике храповика; добавить `npm run test:cov` в pre-commit-привычку.
- [x] **Починить красный базлайн бэкенда** ✅ — было **5 красных** (предсуществующих, не от моих правок):
  - `getBestDayOfWeek` — обновил под гард `sumByDow.size < 3` + добавил кейс на сам гард.
  - 4× `notification.service` — сервис отрефакторили (userId → `bigint`, `markSent` → идемпотентный `updateMany`), спек устарел. Обновил под текущее поведение + усилил тест `getDue` (проверка конверсии bigint→number). Теперь **75/75 зелёных**.

---

# ВОЛНА 1 — P0: Безопасность бэкенда (КРИТИЧНО)

> Здесь баг стоит дороже всего. Обязательны **негативные кейсы** (см. SECURITY.md).

### Аутентификация / авторизация
- [x] `src/api/telegram-auth.guard.ts` ✅ — **100% строк/функций**, 11 тестов: JWT-путь, валидный initData→canonical id, подделка подписи→алерт админу+401, missing/битый user, user.id не number, SKIP_AUTH (вкл в dev / выключен в prod), устойчивость к падению fetch-алерта.
- [x] `src/auth/jwt.guard.ts` ✅ — **100%**, 9 тестов: валидный/missing/не-Bearer/невалидный токен; OptionalJwtGuard (анонимный fallback, link_token, приоритет Bearer).
- [x] `src/auth/auth.service.ts` (495) ✅ — **97% строк**, 37 тестов: initData HMAC (валид/подделка/expired/битый user), JWT round-trips (access/link/merge/totp-challenge, чужой тип/kind), **ротация refresh с детекцией кражи** (reuse → отзыв family + аудит), revoke session/all, findOrCreate (telegram=id / web-range), link/unlink (последний провайдер → Conflict), email magic-link (login + link_email_auth + конфликты), getUserProviders.
- [x] `src/auth/merge.service.ts` (272) ✅ — **100% строк/функций**, 11 тестов (оркестрация): early-return на source==target, всё в одной транзакции, порядок фаз (WebSession→…→DELETE User), Pair/TherapyRelation/ClientConceptualization, повышение роли THERAPIST, перенос recoveryEmail, `summarize`.
  - ✅ **SQL-safety regression** (влито с main): assert `IS DISTINCT FROM` вместо `<>` на nullable `clientId` + orphan-cleanup виртуальных клиентов. Ловит реальный баг: `NULL <> x → NULL` (строка молча теряется при merge). Объединённый спек = **16 тестов** (5 SQL-safety + 8 оркестрация + 3 summarize).
  - ⚠️ Полная корректность SQL (коллизии unique, FK-порядок) — DB-интеграционный тест (Волна 7).
- [x] `src/auth/totp.service.ts` ✅ — **100% строк/функций**, 19 тестов: setup→confirm с валидным TOTP (реальный otplib), recovery-коды (генерация/расход/legacy-массив), disable/regenerate с проверкой кода, isEnabled/getStatus, Conflict/BadRequest/Unauthorized.
- [ ] `src/auth/security-log.service.ts` — пишет событие + DM админу на каждый аудит-тип (merge_confirmed, role_changed, csrf_blocked, suspicious_initdata); не падает если DM не доставлен.
- [x] `src/auth/providers/google.provider.ts` ✅ — **100% строк**, мок `jose`: валидный id_token, провал подписи/aud/iss, nonce mismatch, email не verified, fallback displayName.
- [x] `src/auth/providers/telegram.provider.ts` ✅ **100%** + `telegram-oidc.provider.ts` ✅ — реальная HMAC-подпись (валид/missing/malformed hash/expired/подделка/missing id); OIDC: PKCE, обмен кода, сетевые ошибки token/userinfo, fallback'и displayName.
- [x] `src/auth/providers/vk.provider.ts` ✅ — **100% строк**: PKCE buildAuthUrl, одноразовый verifier, обмен кода (мок fetch), ошибки VK, non-fatal user_info.
- [x] `src/auth/providers/registry.ts` ✅ — **100%**: резолв по id, NotFound на неизвестный, list().
- [x] `src/api/throttler.guard.ts` ✅ — **100% строк/функций**, 10 тестов: ключ per-user (telegramUserId / JWT sub / initData user.id), приоритет, fallback на IP/"unknown", битые токены.

### Шифрование / данные
- [x] `src/utils/crypto.ts` (134) ✅ — **98.46% строк / 100% функций**, 23 теста. round-trip, ротация ключей (OLD fallback), reencrypt, tamper/чужой ключ, encryptRecord/decryptRecord, prod-гарды. Непокрыта 1 защитная строка (недостижима по типовому контракту).
- [x] `src/utils/encrypt-migration.ts` (118) ✅ — **100% строк/функций**, 7 тестов: bail без ключа, шифрование плейнтекста по всем моделям (Note/User/diary/concept+history), идемпотентность (уже зашифрованное не трогается).

### Therapy (авторизация доступа к чужим данным)
- [~] `src/therapy/therapy.service.ts` (889) — **P0 authz-ядро покрыто** (26 тестов): `assertRelation` (active/нет/виртуальный клиент), подключение (`createInvite`/`joinAsClient` — self-join, занятый код, идемпотентность), заметки (гейтинг + scope по therapistId), карты режимов и кастомные режимы (проверка владельца → 'Not found', IDOR закрыт), createModeMap/CustomMode валидация. ⚠️ Покрытие файла ~21% — **остаются data-методы** (Волна 2): `getClients`/`getClientData`/`getClientHistory`/`getClientDiaryEntries` (14-дн история, шифрование), задачи (`createTask`/`getTasks`/`completeTask`/стрики), `get/saveConceptualization`, `requestYsq`, `renameClient`/`removeClient`, `updateSessionInfo`.
- [x] `src/therapy/therapist-request.service.ts` (171) ✅ — **100% строк**, 23 теста: submit-валидация, conflict-состояния, assertAdmin, повышение роли в транзакции, HTML-escape, не-фатальные уведомления.

---

# ВОЛНА 2 — P1: Ядро бизнес-логики бэкенда

- [~] `src/bot/bot.service.ts` (658) — **критичное ядро покрыто** (22 теста): валидация оценок (0..10, целые), saveRating/getRatings, роли (setRole/getUserRole + therapistMode), registerUser (валидация tz), шифрование заметок, saveChildhoodRatings, **`deleteAllUserData`** (полнота каскада по всем USER_DATA_TABLES + therapist-side + auth + User + VACUUM, не-фатальность VACUUM). ⚠️ Покрытие ~25% — остаются ~40 тонких CRUD-обёрток (пары/практики/планы/письма/карточки/belief/safeplace/ysq/diary) — Волна 2 добор.
- [x] `src/bot/bot.analytics.service.ts` (399) ✅ — **87% строк**, 29 тестов: getStreakData (current/longest/слияние источников), getAchievements (first_day/high_day/all_above7/comeback/growth), getLowStreakNeeds, getHistoryRatings, getTotalDaysFilled, getWorstDayOfWeek, + ранее getWeekly/Consecutive/BestDay. ⚠️ Не покрыт `getAdminStats` (282-377, большой админ-форматтер строки, read-only, low-risk) — отложен.
- [x] `src/bot/diary.service.ts` (183) ✅ — **100% строк/функций**, 13 тестов: schema/mode/gratitude дневники — шифрование на запись, плейнтекст наружу, расшифровка на чтение, legacy-массивы, scope по userId на delete.
- [x] `src/bot/profile.service.ts` (77) ✅ — **100% строк/функций**, 5 тестов: дефолты для нового юзера, агрегация user+ysq+streak+last-activity, активные схемы YSQ, форматирование дат.
- [x] `src/utils/tz.ts` (16) ✅ — **100% строк/функций**, 7 тестов: localDate (границы суток Токио/LA), localMidnightUTC (UTC/+9/-7).
- [x] `src/utils/ysq.ts` (48) ✅ — **100% строк/функций**, 10 тестов: скоринг pct5plus, порог ≥5, неполные ответы, computeActiveSchemas (строгое >50%).
- [ ] `src/notification/notification.service.ts` — *(спек есть)* добить ветки: расписание, пропуск отправки, ошибки.
- [ ] `src/notification/notification.templates.ts` — *(спек есть)* проверить все шаблоны/склонения.
- [ ] `src/telegram/telegram.settings.service.ts` (189) — настройки уведомлений; таймзона; вкл/выкл.
- [x] `src/telegram/telegram.schedule.service.ts` (352) ✅ — **79% строк**, 18 тестов: rescheduleForUser (вкл/выкл), processQueue (отправка+markSent, **permanent 403 → markSent+blocked, transient → НЕ markSent/ретрай, нет шаблона → skip**), onDiaryComplete (отмена reminder-семейства + summary + стрик-вехи без дублей), scheduleDailyReminders (lapsing-детекция, не переуведомляет), scheduleWeeklySummaries (пропуск дормантных/дублей).

---

# ВОЛНА 3 — P1: Чистые функции фронтендов (дёшево, ценно)

### Миниапп (`schema-miniapp/src/`)
- [x] `utils/format.ts` ✅
- [x] `utils/drafts.ts` ✅
- [x] `utils/theme.ts` ✅
- [ ] `utils/therapistContact.ts` (50) — формирование контакта/ссылки; пустые поля.
- [ ] `utils/safezone.ts` (59) — `useSafeTop` через `renderHook`: чтение insets, iOS-fallback 56px, реакция на события Telegram, очистка слушателей.

### Webapp (`webapp/src/`) — после Волны 0
- [ ] `utils/format.ts`, `utils/drafts.ts`, `utils/theme.ts`, `utils/therapistContact.ts`, `utils/storageKeys.ts`, `utils/safezone.ts` — **почти дубль миниаппа**, тесты клонируются с правками.
- [x] `hooks/useHistorySheet.ts` (46) ✅ — 3 теста через `MemoryRouter`+`renderHook`: монтирование не закрывает, `goBack` → `onClose`.
- [x] `utils/format.ts`, `utils/drafts.ts`, `utils/theme.ts`, `utils/storageKeys.ts` ✅ — покрыты (theme — дефолт light + `setMatchMedia`; storageKeys — `shouldShowChildhoodWheel`).
- [ ] `game/engine.ts` (177) — тик игры, коллизии, счёт, состояние game-over. Чистая логика — 100%.
- [ ] `game/obstacles.ts` (163) — генерация препятствий, спавн, границы.
- [ ] `game/draw.ts` (245) — низкий приоритет (canvas-рисование), можно отложить.

---

# ВОЛНА 4 — P2: API-слой

### Бэкенд-контроллеры (integration / e2e через supertest)
- [~] `src/api/api.controller.ts` (693) — **integration (supertest) на сквозные инварианты** (6 тестов): гвард `TelegramAuthGuard` реально навешан (401 без креды / на невалидный токен), `userId` берётся из верифицированного токена а не из тела, **анти-эскалация** `therapistMode` (не в белом списке user-flags). Остальные ~60 эндпоинтов — тонкие делегации в покрытые сервисы; добор по необходимости.
- [ ] `src/api/diary.controller.ts` (143) — CRUD дневника через API; авторизация.
- [ ] `src/api/booking.controller.ts` (76) — booking-флоу.
- [~] `src/auth/auth.controller.ts` (903) — **integration (supertest) на security-механизм** (8 тестов): CSRF-защита refresh/logout (нет заголовка/не-JSON → 401 + аудит `csrf_blocked`), refresh-cookie флаги (HttpOnly/Secure/SameSite=Strict/Path), ротация по cookie, logout-отзыв (+all=true → revokeAllSessions), `JwtAuthGuard` навешан на `/me`. ⏳ OAuth-callback'и (google/vk/telegram-oidc redirect-флоу) — провайдеры покрыты юнитами, сами callback'и — кандидаты на e2e (Волна 7).
- [ ] `src/therapy/therapy.controller.ts` (422) — доступ терапевта; 403 на чужое.
- [ ] `src/meta.controller.ts` (32) — health/meta.
- [ ] `src/filters/prisma-exception.filter.ts` + `src/prisma/prisma-exception.filter.ts` — маппинг ошибок Prisma в HTTP-коды; не течёт стектрейс.

### Клиенты API фронтендов (мок `fetch`)
- [ ] `schema-miniapp/src/api.ts` (362) — **цель 100%.** правильный URL/метод/тело; заголовок initData; обработка не-2xx; парсинг; таймауты.
- [ ] `webapp/src/api.ts` (390) — то же + JWT-заголовки, refresh при 401.

---

# ВОЛНА 5 — P2/P3: Хуки и stateful-логика фронтендов

- [ ] `schema-miniapp/src/useUserFlags.ts` (115) — чтение/запись флагов; дефолты; синхронизация.
- [ ] `webapp/src/components/therapist/useClientDetail.ts` (328) — загрузка данных клиента; состояния loading/error; авторизация.
- [ ] Вынести логику из крупных компонентов в хуки/хелперы, где она сейчас вшита (см. правило ~200 строк) → затем покрыть.

---

# ВОЛНА 6 — P3: Компоненты (по убыванию риска фичи)

> Тестировать поведение: что рендерится, какие колбэки зовутся, состояния пустое/ошибка/загрузка. Не стили.

### Высокий риск (логика расчётов/ввод данных)
- [ ] `YSQTestSheet.tsx` (миниапп 954 / webapp 966) — прохождение теста, подсчёт, навигация по вопросам, неполные ответы.
- [ ] `NeedSlider.tsx` / `NeedDial.tsx` — ввод значения, границы 0–10, колбэк сохранения.
- [ ] `CheckInSheet.tsx` / `NeedTodaySheet.tsx` — ежедневная отметка, сохранение оценок.
- [ ] `components/diary/*` (SchemaEntrySheet, ModeEntrySheet, GratitudeEntrySheet, DiaryListView) — создание/листинг записей, черновики.
- [ ] `ChildhoodWheelSheet.tsx` (568) — колесо потребностей, ввод.
- [ ] `TherapistClientSheet.tsx` (~1.3k, есть в обоих) — **разбить и покрыть**; доступ к данным клиента.
- [ ] webapp `ModeMap*` (Canvas, NodeEditor, Nodes, Palette, Editor) — редактор карты режимов: добавление/связи/удаление узлов.

### Средний риск (навигация/состояние экранов)
- [ ] `sections/*` (Today, Schemas, Profile, Help, Diary, Practice) — рендер, переключение, пустые состояния.
- [ ] `HistoryView.tsx`, `TodayView.tsx`, `PlansScreen.tsx`, `PracticesScreen.tsx`.
- [ ] `SettingsSheet.tsx` — смена настроек, темы, таймзоны.
- [ ] `App.tsx` (миниапп 978) / `AppShell.tsx` (webapp 730) — корневой роутинг по boolean-state; **сначала вынести логику** видимости экранов в хелпер/редьюсер, потом покрыть.

### Низкий риск (презентационные)
- [ ] `Loader`, `Celebration`, `FloatingPill`, `BottomNav`, `Flashcard`, `*IntroSheet`, `*InfoSheet` — smoke-рендер + ключевой колбэк. Низкий приоритет.

### Webapp-страницы (контент-лендинги)
- [ ] `pages/LandingPage`, `ArticlesPage`, `OfferPage`, `PrivacyPage`, `LoginPage`, `AccountPage` — рендер без падений, ключевые CTA/ссылки, `AccountPage` — «Привязать Telegram»/merge-флоу.

---

# ВОЛНА 7 — P4: E2E smoke (сквозные сценарии)

- [ ] Бэкенд e2e (`test/`, supertest): полный auth-флоу (login → access → refresh → logout); merge Google→Telegram; удаление аккаунта стирает все данные.
- [ ] Миниапп: первый вход → отметка потребности → запись дневника → история.
- [ ] Webapp: регистрация → привязка Telegram → данные подтянулись из миниаппа (общий userId).

---

## Правило: мультиключевые таблицы и merge (ОБЯЗАТЕЛЬНО)

Любая новая таблица с **двумя ссылками на User** (`therapistId`+`clientId`, `userId1`+`userId2`):
1. Проверить и обновить `src/auth/merge.service.ts` — такие таблицы НЕ покрываются общим bulk UPDATE по `userId`, им нужен отдельный блок.
2. Написать **regression-тест** в `merge.service.spec.ts` со строковым assert на SQL.
3. **NULL-ловушка:** если колонка nullable (напр. `clientId`=NULL у виртуальных клиентов) — только `IS DISTINCT FROM`, никогда `<>` (в SQL `NULL <> x → NULL` → строка молча теряется при merge). Тест ассертит `IS DISTINCT FROM` и `.not.toMatch(/"clientId"\s*<>/)`.

Подробно — память `project_merge_rules.md` и чеклист «Новая таблица» в `CLAUDE.md`.

## Покрытие и храповик

- Цель по типам: чистые функции (`utils/`, `crypto`, `ysq`, `api.ts`, `game/engine`) → **100%**; auth/merge/therapy → **100% + негативные кейсы**; хуки → 100% логики; компоненты → ключевые сценарии.
- Пороги в конфигах только **растут**. Понизить = откатить дисциплину.
- `npm run test:cov` в каждой части = бэклог незакрытых строк.

## Порядок исполнения (рекомендация)

1. Волна 0 (инфра webapp + пороги) — разблокирует.
2. Волна 1 (P0 безопасность бэка) — наибольший риск.
3. Волна 3 (чистые функции фронтов) — параллельно, дёшево, поднимает мораль/проценты.
4. Волна 2 (ядро бэка) → Волна 4 (API) → Волна 5 (хуки) → Волна 6 (компоненты) → Волна 7 (e2e).
