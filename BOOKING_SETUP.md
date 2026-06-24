# Настройка системы записи

Все интеграции включаются через **env-переменные** (Amvera → env, как `BOT_TOKEN`).
Если переменные не заданы — модуль работает в безопасном дефолте и **ничего не делает
с внешними аккаунтами**. Ниже — что включает каждая группа и что будет без неё.

## Сводка: что работает без настройки

| Функция | Без env | С env |
|---|---|---|
| Слоты, бронь, отмена | ✅ работает | ✅ |
| Ссылка на встречу | Jitsi (бесплатная комната) | Zoom recurring на клиента |
| Запись в Apple Calendar | ❌ пропускается | ✅ CalDAV-пуш |
| Оплата платных сессий | авто-подтверждение (dev) | Robokassa |
| Уведомления в Telegram | ✅ (бот уже настроен) | ✅ |

---

## 1. Обязательное

```
ADMIN_BOOKING_KEY=<любая длинная случайная строка>
SITE_URL=https://schemalab.ru
```
- `ADMIN_BOOKING_KEY` — пароль для входа в админку `/booking-admin` (расписание, брони).
- `SITE_URL` — база для ссылок возврата после оплаты и для CalDAV.

Плюс применить миграции БД (`20260623000001_add_booking_system`,
`20260623000002_add_client_meeting`) — на проде применяются автоматически при деплое.

### Резерв уведомлений на почту (рекомендуется)
Все админ-уведомления (записи, ошибки сервера, security-события) идут в Telegram,
а **если Telegram недоступен — дублируются на email** через Resend:
```
RESEND_API_KEY=...                 # ключ Resend (resend.com)
ADMIN_EMAIL=ты@example.com         # куда слать резервные уведомления
EMAIL_FROM=SchemaLab <no-reply@schemalab.ru>
```
Без `ADMIN_EMAIL`/`RESEND_API_KEY` резерв просто не сработает (Telegram продолжит работать).

## 2. Zoom (персональная ссылка на клиента)

Создать **Server-to-Server OAuth** app: marketplace.zoom.us → Develop → Build App.
Скоуп `meeting:write:admin`. Со страницы App Credentials:
```
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
```
Без этих переменных ссылка генерится через Jitsi. Каждому клиенту (по контакту)
создаётся одна recurring-встреча и переиспользуется для всех его сессий.

Альтернатива Zoom — одна общая постоянная комната:
```
MEETING_STATIC_URL=https://...   # напр. постоянная комната Телемост/Zoom
```
Если задано — используется она для всех (приоритетнее Zoom).

## 3. Apple Calendar (CalDAV)

App-specific password: appleid.apple.com → Sign-In & Security → App-Specific Passwords.
Нужны всего два значения — URL календаря **обнаруживается автоматически**:
```
APPLE_ID=твой@icloud.com
APPLE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```
Опционально:
```
APPLE_CALENDAR_NAME=Работа          # какой календарь использовать (по имени);
                                    # по умолчанию — первый, поддерживающий события
APPLE_CALDAV_URL=https://pXX-...     # если авто-обнаружение не сработало — задать вручную
```
Без `APPLE_*` подтверждённые брони просто не пишутся в календарь (всё остальное работает).
Если в логах увидишь «CalDAV auto-discovery found no calendar» — задай `APPLE_CALDAV_URL` вручную.

## 4. Robokassa (оплата платных сессий)

```
ROBOKASSA_MERCHANT_LOGIN=...
ROBOKASSA_PASSWORD1=...
ROBOKASSA_PASSWORD2=...
ROBOKASSA_IS_TEST=true   # на время тестов; убрать/false для боевого режима
```
В кабинете Robokassa указать ResultURL → `https://schemalab.ru/api/payment/result`.
Без переменных платная сессия подтверждается сразу (dev-режим), деньги не списываются.

---

## Как это собирается вместе

1. Клиент выбирает слот на сайте → `POST /api/booking/book`.
2. Бесплатное знакомство → бронь сразу CONFIRMED. Платная → HELD + ссылка на Robokassa.
3. На подтверждении (вручную, по оплате или для бесплатной): создаётся/находится
   персональная встреча клиента (Zoom/Jitsi), пишется в Apple Calendar, уведомление
   тебе в Telegram, ссылка показывается клиенту.
4. Напоминания за 24ч и 2ч — автоматически (cron).
