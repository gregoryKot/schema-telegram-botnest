# Карта атак-поверхности и матрица покрытия

Фаза 1 аудита (см. `AUDIT_PLAN.md`). Полный инвентарь точек входа Schema Happens.
Матрица покрытия заполняется в Фазах 3–5.

**Легенда гвардов:** TAG = `TelegramAuthGuard` · JWT = `JwtAuthGuard` ·
OJWT = `OptionalJwtGuard` · — = без гварда (валидация внутри) · +csrf =
`requireCsrf` · +role = проверка `getUserRole`/`ADMIN_ID` внутри метода.

**Статус:** ⬜ не проверено · 🔍 в работе · ✅ чисто · ⚠️ находка.

## Сводка поверхности

| Категория | Кол-во |
|-----------|--------|
| HTTP-эндпоинты | 111 |
| Бот-команды | 7 |
| Бот-callbacks (actions) | 12 |
| Cron-джобы | 3 |
| Стартовые джобы | 1 (`migrateClinicalLabels`) |
| Внешние интеграции | 3 (Telegram Bot API, Google OAuth, VK ID) |
| Раздача статики | 1 (`ServeStaticModule`) |

## 1. HTTP — `auth.controller` (`/api/auth`, 13)

| Метод + путь | Гвард | Tier | Статус |
|--------------|-------|------|--------|
| GET google | OJWT | Medium | ⬜ |
| GET google/callback | — | Critical | ⬜ |
| GET vk | OJWT | Medium | ⬜ |
| GET vk/callback | — | Critical | ⬜ |
| POST telegram/widget | OJWT +csrf +throttle | Critical | ⬜ |
| POST telegram/webapp | — | Critical | ⬜ |
| POST merge | OJWT +csrf +throttle | **Critical** | ⬜ |
| POST link/:provider | JWT | High | ⬜ |
| POST unlink/:provider | JWT | Medium | ⬜ |
| POST refresh | — +csrf | High | ⬜ |
| POST logout | — +csrf | Medium | ⬜ |
| GET me | JWT | Low | ⬜ |
| GET link-token | JWT | High | ⬜ |

## 2. HTTP — `diary.controller` (`/api/diary`, 9)

Контроллер целиком под TAG. Все эндпоинты — клинический CRUD (A1), tier Medium.

| Метод + путь | Гвард | Tier | Статус |
|--------------|-------|------|--------|
| GET schema · POST schema · DELETE schema/:id | TAG | Medium | ⬜ |
| GET mode · POST mode · DELETE mode/:id | TAG | Medium | ⬜ |
| GET gratitude · POST gratitude · DELETE gratitude/:id | TAG | Medium | ⬜ |

## 3. HTTP — `api.controller` (`/api`, 62)

Контроллер целиком под TAG.

| Метод + путь | Tier | Статус |
|--------------|------|--------|
| GET link-token | High | ⬜ |
| GET user-flags · POST user-flags | Medium | ⬜ |
| GET drafts · POST drafts/:type · DELETE drafts/:type | Medium | ⬜ |
| GET profile · POST profile/name | Low | ⬜ |
| POST init | Low | ⬜ |
| GET disclaimer · POST disclaimer | Low | ⬜ |
| GET ysq-progress · POST ysq-progress · DELETE ysq-progress | Medium | ⬜ |
| GET needs | Low | ⬜ |
| GET ratings · POST rating | Medium | ⬜ |
| GET history · GET streak · POST activity | Low | ⬜ |
| GET export | Medium | ⬜ |
| GET insights · GET achievements | Low | ⬜ |
| GET note · POST note | Medium | ⬜ |
| GET pair | High | ⬜ |
| POST pair/invite · POST pair/join · DELETE pair | Medium | ⬜ |
| GET settings · POST settings | Medium | ⬜ |
| GET practices · POST practices · DELETE practices/:id | Medium | ⬜ |
| GET plan/pending · POST plan · POST plan/:id/checkin · GET plans/history | Medium | ⬜ |
| GET childhood-ratings · POST childhood-ratings | Medium | ⬜ |
| GET ysq-result · POST ysq-result · DELETE ysq-result · GET ysq-history | Medium | ⬜ |
| GET schema-notes · POST schema-notes | Medium | ⬜ |
| GET mode-notes · POST mode-notes | Medium | ⬜ |
| GET belief-checks · POST belief-checks · DELETE belief-checks/:id | Medium | ⬜ |
| GET letters · POST letters · DELETE letters/:id | Medium | ⬜ |
| GET safe-place · POST safe-place | Medium | ⬜ |
| GET flashcards · POST flashcards · DELETE flashcards/:id | Medium | ⬜ |
| GET therapy/client/:clientId/schema-notes | **High** | ⬜ |
| GET therapy/client/:clientId/mode-notes | **High** | ⬜ |
| DELETE user | **Critical** | ⬜ |

## 4. HTTP — `therapy.controller` (`/api/therapy`, 27)

Контроллер целиком под TAG; роль-чувствительные методы помечены +role.

| Метод + путь | Гвард | Tier | Статус |
|--------------|-------|------|--------|
| POST invite | TAG +role | Medium | ⬜ |
| GET relation | TAG | Low | ⬜ |
| POST join | TAG | High | ⬜ |
| DELETE relation | TAG | Medium | ⬜ |
| GET clients | TAG +role | Medium | ⬜ |
| DELETE clients/:clientId | TAG +role | High | ⬜ |
| POST clients/virtual | TAG +role | Medium | ⬜ |
| POST clients/add | TAG +role | Low (410) | ⬜ |
| POST become-therapist | TAG | Low (410) | ⬜ |
| POST request · GET request | TAG | High / Low | ⬜ |
| POST tasks | TAG +role | **High** | ⬜ |
| GET tasks · GET tasks/history | TAG | Medium | ⬜ |
| GET tasks/all | TAG +role | Medium | ⬜ |
| GET tasks/client/:clientId | TAG +role | High | ⬜ |
| POST tasks/:id/complete | TAG | Medium | ⬜ |
| POST rename-client/:clientId | TAG +role | Medium | ⬜ |
| POST request-ysq/:clientId | TAG +role | High | ⬜ |
| GET client-history/:clientId | TAG +role | **High** | ⬜ |
| GET client-data/:clientId | TAG +role | **High** | ⬜ |
| GET notes/:clientId · POST notes/:clientId | TAG +role | **High** | ⬜ |
| DELETE notes/:noteId | TAG +role | Medium | ⬜ |
| GET conceptualization/:clientId · POST conceptualization/:clientId | TAG +role | **High** | ⬜ |
| POST session-info/:clientId | TAG +role | Medium | ⬜ |

## 5. Бот — команды и callbacks

| Вход | Файл | Авторизация | Tier | Статус |
|------|------|-------------|------|--------|
| cmd `/start` (вкл. deep-link `startapp`) | telegram.service | публичная | Medium | ⬜ |
| cmd `/ping` | telegram.service | публичная | Low | ⬜ |
| cmd `/stats` | telegram.service | `ADMIN_ID` | Medium | ⬜ |
| cmd `/therapist` | telegram.service | публичная (deprecated) | Low | ⬜ |
| cmd `/broadcast` | telegram.service | `ADMIN_ID` | High | ⬜ |
| cmd `/about` | telegram.service | публичная | Low | ⬜ |
| cmd `/settings` | telegram.settings.service | владелец чата | Low | ⬜ |
| action `cancel` · `back:welcome` | telegram.service | публичная | Low | ⬜ |
| action `accept_consent` | telegram.service | `ctx.from.id` | Medium | ⬜ |
| action `treq:(approve\|reject):<id>` | telegram.service | `ADMIN_ID` | **High** | ⬜ |
| action `snooze_reminder` | telegram.service | `ctx.from.id` | Low | ⬜ |
| action `plan_(done\|skip):<id>` | telegram.service | `ctx.from.id` | Medium | ⬜ |
| action `settings:*` (toggle/hour/tz/back, 6 шт.) | telegram.settings.service | `ctx.from.id` | Low | ⬜ |
| `on('message')` / `on('callback_query')` (redirect-режим) | telegram.service | публичная | Low | ⬜ |

## 6. Cron и стартовые джобы

| Джоба | Расписание | Файл | Tier | Статус |
|-------|-----------|------|------|--------|
| `processQueue` (рассылка уведомлений) | `*/5 * * * *` | telegram.schedule.service | Medium | ⬜ |
| ежедневная джоба | `0 0 * * *` | telegram.schedule.service | Low | ⬜ |
| еженедельная джоба | `0 0 * * 0` | telegram.schedule.service | Low | ⬜ |
| `migrateClinicalLabels` | при старте | main.ts / utils | Low | ⬜ |

## 7. Внешние интеграции и инфраструктура

| Элемент | Tier | Статус |
|---------|------|--------|
| Telegram Bot API (исходящие `sendMessage`, `fetch`) | Medium | ⬜ |
| Google OAuth (`token`, `tokeninfo`) | High | ⬜ |
| VK ID (PKCE, `oauth2/auth`, `user_info`) | High | ⬜ |
| `ServeStaticModule` (раздача `webapp/dist`) | Medium | ⬜ |
| HTTP-заголовки безопасности (CSP/HSTS/…) | Medium | ⬜ |
| Управление секретами, история git | High | ⬜ |

## Дисциплина проверки

При проверке каждой строки фиксируется по 8 измерениям: **AuthN** (кто
может вызвать) · **AuthZ** (скоуп доступа, IDOR) · **валидация входа** ·
**rate-limit** · **идемпотентность / гонки** · **кодирование вывода** ·
**обработка ошибок / утечка инфо** · **бизнес-логика / абьюз**. Находки →
`AUDIT_FINDINGS.md`, статус строки → ⚠️; чистая строка → ✅.
