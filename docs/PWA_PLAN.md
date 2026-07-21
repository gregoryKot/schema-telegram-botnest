# План: устанавливаемая аппка (PWA) на базе webapp

Дата: 2026-07-19. Статус: план, не начато.

## Принципиальные решения

1. **База — webapp** (schemehappens.ru), не миниапп и не отдельное приложение.
   Миниапп жёстко завязан на Telegram initData (401 вне Telegram), а «отдельное
   что-то» = дублирование кода против правил №3 и «одна механика — один
   компонент». Миниапп остаётся как есть, внутри Telegram.
2. **Десктоп-дизайн не меняется.** Все изменения — только за
   `@media (max-width: …)` и `@media (display-mode: standalone)`. Ни одного
   изменения вёрстки вне этих гейтов.
3. **SW-стратегия — `injectManifest` с самого начала** (не `generateSW`):
   в фазе 4 понадобится кастомный push-handler в service worker'е, и переезд
   generateSW→injectManifest посреди пути — лишняя переделка.
4. **Web Push — главная новая ценность**: web-only юзеры (Google/VK userId без
   telegramId) сейчас вообще не получают уведомлений — бот им написать не может.
   PWA-пуши закрывают эту дыру.

## Распределение по моделям (кто делает)

- 🔴 **Опус/Фейбл (основная сессия)** — задачи, где ошибка дорого стоит:
  SW-конфиг и кэш-стратегия, авторизация в standalone, схема БД + миграция,
  канал доставки пушей, интеграция с notification planner.
- 🟢 **Делегируется субагенту (haiku/sonnet)** — по написанной спеке:
  manifest-boilerplate, скрипт генерации иконок, UI-компоненты, тексты ты/вы,
  тесты по образцу, доки. Ревью результата — основная сессия.

---

## Фаза 1 — PWA-каркас (manifest + SW + иконки)

### 1.1 🔴 vite-plugin-pwa, стратегия injectManifest
Самая опасная часть: SW регистрируется на корне `schemehappens.ru` и без
исключений **сломает миниапп и OAuth**:

- `navigateFallbackDenylist`: `/^\/app\//` (миниапп в Telegram!), `/^\/api\//`,
  `/^\/auth/` (OAuth-коллбэки, `#tgAuthResult`).
- `/api/*` — **NetworkOnly, никогда не кэшировать** (терапевтические данные;
  privacy: расшифрованные ответы не должны оседать в Cache Storage).
- `/app/*` — SW вообще не перехватывает fetch (миниапп живёт своим циклом,
  его dist коммитится отдельно).
- Precache — только shell webapp; статика (fonts, иконки) — CacheFirst.
- `start_url: /?utm_source=pwa` — чтобы запуски из иконки были видны.
- Update-flow: autoUpdate + тост «Доступна новая версия» (ты/вы!).
- Деплой не меняется: SW попадает в `webapp/dist` при обычном билде Amvera.

### 1.2 🟢 manifest.webmanifest
name/short_name (взять действующий нейминг продукта), `display: standalone`,
`theme_color`/`background_color` из обеих тем (manifest один — берём светлую,
тёмная отработает через meta theme-color, который уже есть в index.html),
`lang: ru`, иконки из 1.3.

### 1.3 🟢 Иконки
Скрипт (sharp) из `webapp/public/favicon.svg` → 192, 512, maskable-512
(+ проверить существующий apple-touch-icon 180 на непрозрачный фон).
Скрипт — одноразовый, в `scripts/`, результат коммитится.

### 1.4 🟢 Аналитика (правило №8)
События: `pwa_install_prompt_shown`, `pwa_installed` (appinstalled),
`pwa_launch` (display-mode: standalone при старте). Allow-list в
`src/analytics/analytics.constants.ts` + тест.
⚠️ Этот файл сейчас правит параллельная сессия (WEB_BANNER_IDS) — коммитить
через изолированный worktree от origin/main.

### 1.5 🟢 Тесты
vitest: detection standalone-режима, логика показа install-баннера (фаза 2.3).

**Проверка фазы:** Lighthouse PWA-чек зелёный; миниапп в Telegram работает;
логин через все три провайдера работает; в Android Chrome появляется
предложение установки.

---

## Фаза 2 — мобильный UX + install-баннер (десктоп не трогаем)

### 2.1 🟢→🔴 Аудит мобильной вёрстки
В webapp уже 34 `@media` — адаптив есть. Субагент проходит основные экраны
на 375px и составляет список дефектов; фиксы — по итогам, каждый строго
внутри media query.

### 2.2 🟢 Safe-area (iOS)
`viewport-fit=cover` + `env(safe-area-inset-*)` паддинги **только** в
`@media (display-mode: standalone)` — чёлка и home-индикатор.

### 2.3 🔴 спека / 🟢 код — InstallBanner
- Android/Chrome: перехват `beforeinstallprompt` → кнопка «Установить».
- iOS Safari: инструкция «Поделиться → На экран „Домой“» (баннера в iOS нет —
  ограничение Apple).
- Показ: только мобильные, не в standalone, не в Telegram-WebView;
  скрытие навсегда — **реюз паттерна dismissed-баннеров** (параллельная сессия
  уже делает `webBanner.ts` в миниаппе — кандидат на вынос в `shared/`,
  правило №3, решить на момент реализации по состоянию main).
- Онбординг-правило: баннер отвечает «зачем» («иконка на экране, открывается
  как приложение, быстрее»). Все строки через `useTr()` (ты/вы).
- Событие показа/установки/скрытия — из 1.4.

**Проверка фазы:** на реальном Android поставилась с баннера; на реальном
iPhone — через «На экран „Домой“»; десктоп — `git diff` вёрстки вне
media-гейтов пустой.

---

## Фаза 3 — авторизация в standalone 🔴 (целиком основная сессия)

Хорошая база: все три логина (Google `/api/auth/google`, VK, Telegram widget
`/api/auth/telegram/redirect`) — **full-page redirect**, не popup. Redirect-flow
в standalone-PWA работает: внешний OAuth-домен открывается in-app, возврат на
свой origin возвращает в аппку.

Задачи:
1. **Тест на реальных устройствах** всех трёх флоу в установленной PWA
   (iOS: у standalone отдельное хранилище от Safari — юзер логинится заново
   внутри аппки, это норма; главное чтобы redirect вернулся в standalone-контекст,
   включая ветки TOTP и merge).
2. **Сессия не должна протухать**: access 15 мин / refresh-cookie 30 дней уже
   есть. Проверить: refresh — rolling (продлевается при использовании)?
   Если нет — сделать rolling, иначе аппка «умирает» через 30 дней даже при
   ежедневном использовании. Тест на ротацию.
3. **Silent refresh при старте standalone**: холодный старт аппки после
   долгого сна → тихо обновить access по cookie до первого API-вызова,
   не показывая login-экран.
4. Fallback, если Telegram-widget в standalone iOS всё же не вернётся
   (известные капризы oauth.telegram.org): вход по одноразовому коду через
   бота (`t.me/<bot>?start=weblogin_<code>`) — бот уже есть, механика
   аналогична существующим deep-link'ам. Делать **только если** тест №1
   покажет проблему.

---

## Фаза 4 — Web Push уведомления (ядро 🔴)

### 4.1 🔴 БД: модель PushSubscription
`userId, endpoint, p256dh, auth, createdAt, updatedAt` + unique(userId, endpoint).
**Полный чеклист новой таблицы** (CLAUDE.md): `USER_DATA_TABLES` +
`USER_OWNED_TABLES` (+`UNIQUE_RULES`), `EncryptSchema { strings: ['endpoint',
'p256dh', 'auth'] }` (endpoint — capability-URL, по нему можно слать пуши юзеру),
`onDelete: Cascade`, `prisma generate`. Миграция — через `prisma migrate dev`,
помнить ловушку `updatedAt NOT NULL без DEFAULT`.

### 4.2 🔴 Env + ключи
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` через ConfigService;
генерация `npx web-push generate-vapid-keys`. 🟢 Дописать в CLAUDE.md раздел
«Критичные env» (ротация VAPID = все подписки мертвы, юзеры переподписываются).

### 4.3 🔴 API
`POST /api/push/subscribe`, `DELETE /api/push/subscribe` — DTO с
class-validator (правило №6), авторизация JWT, rate-limit по верифицированному
sub (правило №5).

### 4.4 🔴 Канал доставки в notification-пайплайне
Сейчас planner/cadence шлют только через Telegram-бот. Ввести абстракцию
канала доставки:
- есть `telegramId` → Telegram (как сейчас, ничего не меняется);
- web-only юзер + есть подписка → web push (новая ценность: сейчас у них 0
  уведомлений);
- дублирование каналов — НЕ делаем (раздражает), Telegram primary.
Бюджеты/тихие часы/паузы (`PROACTIVE_TYPES`, `QUIET_EXEMPT_TYPES`) действуют
одинаково для обоих каналов — логика остаётся в planner, канал — только
транспорт.

### 4.5 🟢 Тексты пушей
Реюз `notification.templates.ts` (уже двухформенные ты/вы через `t(form,…)`),
обрезка под лимиты пуша (title ~50, body ~120). Тест на маппинг
NotificationType → push payload.

### 4.6 🔴 SW push-handler
`push` event → showNotification; `notificationclick` → фокус/открытие нужного
раздела (url в payload). Это и есть причина injectManifest из 1.1.

### 4.7 🔴 спека / 🟢 код — UI настройки
Тумблер «Уведомления» в настройках профиля webapp. Permission — **только по
клику** (не на загрузке). Состояния: granted / denied (инструкция как включить
в системе) / unsupported (iOS < 16.4, iOS вне standalone — объяснить «установи
на экран Домой»). ты/вы. События: `push_subscribed`, `push_denied`,
`push_unsubscribed`.

### 4.8 🔴 Отправка + тесты
Lib `web-push`; 404/410 от push-сервиса → удалить мёртвую подписку.
Тесты: мокнутый транспорт; **read-after-write**: подписался → planner выбрал
web-канал → payload дошёл до транспорта; отписался → не шлётся; юзер с
telegramId → web-канал не выбран.

**Ограничения iOS (принимаем, не чиним):** пуши только iOS 16.4+, только в
установленной PWA, permission только по жесту. Android — без ограничений.

---

## Фаза 5 — полировка (опционально, после обкатки)

- Offline-fallback страница «Нет сети» (ты/вы).
- Кэш публичных статей `/articles` (не пользовательские данные — можно).
- Lighthouse-аудит 🟢, донастройка precache.

## Порядок

Фаза 1 → (2 ∥ 3) → 4 → 5. Каждая фаза — отдельный PR со всеми гейтами CI
(vitest, eslint-храповик, jscpd, route-collisions, migrations).
Грубая оценка: 1 — день; 2 — день; 3 — 0.5–1 (без fallback-кода);
4 — 2–3 дня; 5 — по желанию.

## Риски

| Риск | Митигация |
|---|---|
| SW ломает миниапп `/app/` или OAuth-коллбэки | Denylist в 1.1 + ручная проверка миниаппа в чеклисте каждой фазы |
| SW закэшировал старую версию после деплоя | autoUpdate + тост; проверка после первого прод-деплоя |
| Telegram-widget не возвращается в standalone iOS | Тест на устройстве до написания кода; fallback-код по факту (3.4) |
| Приватные данные в Cache Storage | `/api` NetworkOnly — закреплено конфигом и ревью |
| Рассинхрон с параллельными сессиями (analytics.constants.ts, webBanner) | Коммиты только через worktree от origin/main; перед фазой 2.3 — свериться с main |
