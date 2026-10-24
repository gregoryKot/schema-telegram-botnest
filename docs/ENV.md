# Env-переменные

Реестр всех env-переменных, которые читает `src/**` — `src/infra/env-registry.entries*.ts`
(типы и валидаторы форматов — `src/infra/env-registry.ts`). Таблица ниже синхронна с
реестром: тест `src/infra/env-registry.docs.spec.ts` падает, если переменная появилась в
коде и не появилась здесь (или наоборот).

Секреты (значения) сюда не попадают — только имена, обязательность и формат.

Что проверяется дополнительно (не сводится к формату одной переменной) — кросс-проверки
в `src/infra/env-check.ts` (`CROSS_CHECKS`): если задан `RESEND_API_KEY`, обязаны быть
заданы `ADMIN_EMAIL` и `EMAIL_FROM`; если задан `GOOGLE_CLIENT_ID` — `GOOGLE_CLIENT_SECRET`
и `GOOGLE_REDIRECT_URI`; если задан `VK_APP_ID` — `VK_REDIRECT_URI`; если задан `ROBOKASSA_MERCHANT_LOGIN` — `ROBOKASSA_PASSWORD1`
и `ROBOKASSA_PASSWORD2` (пустой пароль позволил бы подделать подпись вебхука); `ENCRYPTION_KEY_OLD`
не должен совпадать с текущим `ENCRYPTION_KEY`; если задан `BACKUP_S3_BUCKET` — обязаны быть
`BACKUP_S3_ENDPOINT`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` и `BACKUP_ENCRYPTION_KEY`
(иначе бэкапы молча не запустятся), а `BACKUP_ENCRYPTION_KEY`
не должен совпадать с `ENCRYPTION_KEY`; `SKIP_AUTH=true` запрещён в production;
адрес возврата OAuth обязан вести на канонический хост (сверка — `src/auth/oauth-redirect-config.ts`).

На старте (`src/main.ts`) и в `/stats` (блок «Настройки: переменные») видно, что не задано
или задано неверно — см. `src/infra/env-check-boot-log.ts` и `src/bot/env-check.format.ts`.
В production отсутствие обязательной переменной или неверный формат — `logger.error`
(уходит владельцу в DM через AlertLogger); вне production — `logger.warn`, приложение не
падает (кроме `ENCRYPTION_KEY`/`DATABASE_URL` — они и раньше валили процесс на старте
раньше этой проверки, см. `src/utils/crypto.ts`, `PrismaService`).

Отдельно от этого реестра: `src/infra/capability-report.ts` — про «фича молча ВЫКЛЮЧЕНА,
если переменной нет» (что видно в `/stats` блоком «Настройки»).

## Вход и шифрование

| Переменная | На проде | Формат | Назначение |
|---|---|---|---|
| `ENCRYPTION_KEY` | **обязательна** | hex32 | Ключ AES-256-GCM (заметки, дневники) и HMAC ключа комнаты клиента (ClientMeeting.clientKey); без него прод не стартует (utils/crypto.ts). |
| `ENCRYPTION_KEY_OLD` | опциональна | any | Старые ключи на время ротации (через запятую) — для расшифровки и поиска комнаты клиента; новое всегда пишется текущим ключом. |
| `GOOGLE_CLIENT_ID` | опциональна | nonEmpty | OAuth client id входа через Google — без него кнопка «Войти через Google» недоступна. |
| `GOOGLE_CLIENT_SECRET` | опциональна | nonEmpty | OAuth client secret Google — без него обмен кода на токен падает. |
| `GOOGLE_REDIRECT_URI` | опциональна | httpsUrl | Адрес возврата Google после входа — обязан вести на канонический хост (инцидент 2026-09-16: старый хост давал ERR_TOO_MANY_REDIRECTS). |
| `JWT_SECRET` | **обязательна** | secret32 | Подписывает access/refresh/merge/2FA-challenge JWT и state входа сайта, из него выводится PKCE-verifier VK — без него вход через Google/VK и merge аккаунтов не работает. Не короче 32 символов, не заглушка (`secret`, `changeme`, повтор одного символа); генерация: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `MAX_BOT_TOKEN` | опциональна | nonEmpty | Перекрывает HEALTHY_ADULT_MAX_TOKEN для проверки подписи initData мини-аппа MAX, если бот мини-аппа когда-нибудь станет отдельным от канального. |
| `SKIP_AUTH` | опциональна | oneOf(true, false) | Dev-only обход проверки initData — хардкод-запрет в проде (src/api/init-data-paths.ts), в реестре только для формата/кросс-проверки. |
| `VK_APP_ID` | опциональна | nonEmpty | OAuth client id входа через VK ID — без него кнопка «Войти через VK» недоступна. |
| `VK_REDIRECT_URI` | опциональна | httpsUrl | Адрес возврата VK после входа — обязан вести на канонический хост. |

## Бот и мини-апп

| Переменная | На проде | Формат | Назначение |
|---|---|---|---|
| `ADMIN_ID` | **обязательна** | telegramId | Telegram id единственного администратора — без него не работают ни админские команды, ни алерты в Telegram (см. src/utils/admin-alert.ts). |
| `BOT_REDIRECT_USERNAME` | опциональна | nonEmpty | Имя второго бота, на который редиректит /start при миграции (опционально). |
| `BOT_TOKEN` | **обязательна** | botToken | Токен бота BotFather — без него бот не подключается к Telegram и алерты в Telegram не уходят. |
| `BOT_USERNAME` | **обязательна** | telegramUsername | Имя бота без @ для t.me-ссылок; без него приглашения отдают 503. |
| `MINIAPP_APP_NAME` | опциональна | nonEmpty | Slug мини-аппа в t.me/<bot>/<name> — дефолт «diary», если не задано. |
| `MINIAPP_URL` | опциональна | httpsUrl | Адрес мини-аппа для webApp-кнопок; по умолчанию APP_URL + /app/. |
| `TELEGRAM_PROXY_URL` | опциональна | nonEmpty | Исходящий прокси до api.telegram.org на случай, если маршрут с хостинга не работает напрямую — без него бот ходит напрямую. |
| `UNIFIED_FRONTEND` | опциональна | oneOf(1, true, 0, false) | Единая версия: `/app/*` мини-аппа редиректится в кабинет `/today`, `/app/sw.js` отдаёт заглушку, снимающую старый service worker. Значения `1`/`true` включают, иначе выключено. Включается на этапе 5 плана docs/ONE_FRONTEND_PLAN.md. |

## Почта

| Переменная | На проде | Формат | Назначение |
|---|---|---|---|
| `ADMIN_EMAIL` | опциональна | email | Почта владельца для писем о записях и резервных алертов — без неё, при заданном RESEND_API_KEY, письма молчат (инцидент 2026-09-15). |
| `EMAIL_FROM` | опциональна | nonEmpty | Адрес отправителя писем (magic-link, уведомления) — есть дефолт «Schema Happens <no-reply@schemehappens.ru>», если не задан. |
| `RESEND_API_KEY` | опциональна | nonEmpty | Ключ Resend — без него почта пользователям и владельцу не отправляется (magic-link, письма о записях, резервные алерты). |

## Канал «Здоровый Взрослый»

| Переменная | На проде | Формат | Назначение |
|---|---|---|---|
| `HEALTHY_ADULT_CHANNEL` | опциональна | nonEmpty | Telegram-канал (@username или -100…id) — без него площадка Telegram выключена. |
| `HEALTHY_ADULT_MAX_CA` | опциональна | any | Перекрытие корневого сертификата для запросов в MAX — по умолчанию берётся из репозитория (assets/ca), переменная нужна только для смены без деплоя. |
| `HEALTHY_ADULT_MAX_CHAT` | опциональна | nonEmpty | Id чата/канала MAX для публикации — без него площадка MAX выключена. |
| `HEALTHY_ADULT_MAX_TOKEN` | опциональна | nonEmpty | Токен бота MAX — постит в канал И подписывает initData мини-аппа MAX (один бот на обе роли, см. CLAUDE.md). |
| `HEALTHY_ADULT_PINTEREST_BOARD` | опциональна | nonEmpty | Id доски Pinterest — без него площадка Pinterest выключена. |
| `HEALTHY_ADULT_PINTEREST_TOKEN` | опциональна | nonEmpty | Токен доступа Pinterest API. |
| `HEALTHY_ADULT_THREADS_RELAY` | опциональна | url | Адрес ретранслятора Threads (Cloudflare Worker) — без него запросы идут напрямую в graph.threads.net (недоступен с российского хостинга). |
| `HEALTHY_ADULT_THREADS_RELAY_SECRET` | опциональна | nonEmpty | Секрет для ретранслятора Threads — без него ретранслятор отвечает 403. |
| `HEALTHY_ADULT_THREADS_TOKEN` | опциональна | nonEmpty | Стартовый токен Threads — актуальный живёт в БД и обновляется кроном, эта переменная нужна только один раз при первом подключении. |
| `HEALTHY_ADULT_THREADS_USER` | опциональна | nonEmpty | Id пользователя Threads (или «me») — без него площадка Threads выключена. |
| `HEALTHY_ADULT_VK_GROUP` | опциональна | nonEmpty | Id сообщества ВКонтакте — без него площадка VK выключена. |
| `HEALTHY_ADULT_VK_TOKEN` | опциональна | nonEmpty | Ключ доступа сообщества VK (права «Стена»). |

## Запись на консультацию

| Переменная | На проде | Формат | Назначение |
|---|---|---|---|
| `ADMIN_BOOKING_KEY` | **обязательна** | any | Ключ админских эндпоинтов записи/статей/контента сайта — без него они отвечают 403 всем (assertAdminKey отказывает закрыто, не открыто). Не короче 32 символов: более короткий ключ приравнен к незаданному. |
| `APPLE_APP_PASSWORD` | опциональна | nonEmpty | Пароль приложения для CalDAV iCloud — вместе с APPLE_ID включает личный календарь. |
| `APPLE_CALDAV_URL` | опциональна | url | Явный адрес коллекции календаря iCloud — без него используется автообнаружение. |
| `APPLE_CALENDAR_NAME` | опциональна | nonEmpty | Имя календаря iCloud для выбора среди нескольких — опционально. |
| `APPLE_ID` | опциональна | email | Apple ID (email) для CalDAV — без него личный календарь в слотах записи не учитывается. |
| `CALENDAR_BLOCK_SLOTS` | опциональна | oneOf(true, false) | «true» — занятые в личном календаре часы скрываются из слотов записи. |
| `MEETING_STATIC_URL` | опциональна | url | Постоянная резервная комната встреч (Jitsi и т.п.), если Zoom не настроен. |
| `ROBOKASSA_FISCAL` | опциональна | oneOf(true, false) | «false» — не отправлять фискальный чек в Робокассу (по умолчанию включён). |
| `ROBOKASSA_IS_TEST` | опциональна | oneOf(true, false) | «true» — тестовый режим Робокассы. |
| `ROBOKASSA_MERCHANT_LOGIN` | опциональна | nonEmpty | Логин магазина в личном кабинете Робокассы — без него оплата недоступна. |
| `ROBOKASSA_PASSWORD1` | опциональна | nonEmpty | Пароль №1 Робокассы — подпись ссылки на оплату. |
| `ROBOKASSA_PASSWORD2` | опциональна | nonEmpty | Пароль №2 Робокассы — проверка подписи вебхука об оплате. |
| `ZOOM_ACCOUNT_ID` | опциональна | nonEmpty | Server-to-Server OAuth аккаунт Zoom — вместе с CLIENT_ID/SECRET включает личные Zoom-ссылки. |
| `ZOOM_CLIENT_ID` | опциональна | nonEmpty | Client id Server-to-Server приложения Zoom. |
| `ZOOM_CLIENT_SECRET` | опциональна | nonEmpty | Client secret Server-to-Server приложения Zoom. |

## Инфраструктура и сайт

| Переменная | На проде | Формат | Назначение |
|---|---|---|---|
| `ALLOWED_ORIGINS` | опциональна | any | CORS-список источников через запятую (нужен мини-аппу — другой origin) — без него используется дефолтный список из main.ts. |
| `APP_URL` | опциональна | nonEmpty | Базовый адрес для ссылок в письмах/боте (donate, subscribe) — дефолт schemehappens.ru; допускается голый домен без схемы (normalizeBaseUrl). |
| `BACKUP_ENCRYPTION_KEY` | опциональна | secret32 | Ключ шифрования бэкапов БД (AES-256, ≥ 32 символов) — ОТДЕЛЬНЫЙ от ENCRYPTION_KEY: утечка одного не открывает другое. Хранить ещё и вне Amvera: без него бэкап не расшифровать. |
| `BACKUP_RETENTION_DAYS` | опциональна | retentionDays | Сколько дней хранить бэкапы в бакете (по умолчанию 90, не меньше 7) — старше удаляются после каждого успешного бэкапа. |
| `BACKUP_S3_ACCESS_KEY_ID` | опциональна | accessKey | Access Key ID API-токена Cloudflare R2 (Object Read & Write только на бакет бэкапов) — пара к BACKUP_S3_SECRET_ACCESS_KEY. |
| `BACKUP_S3_BUCKET` | опциональна | bucketName | Имя приватного бакета R2 для зашифрованных бэкапов БД — без него бэкапы не запускаются (deploy/backup-scheduler.cjs). |
| `BACKUP_S3_ENDPOINT` | опциональна | s3Endpoint | Адрес S3-API хранилища бэкапов без бакета: https://<id аккаунта>.r2.cloudflarestorage.com. |
| `BACKUP_S3_REGION` | опциональна | nonEmpty | Регион в подписи запросов к хранилищу — по умолчанию auto (так требует R2); менять только при переезде на другое S3-хранилище. |
| `BACKUP_S3_SECRET_ACCESS_KEY` | опциональна | accessKey | Secret Access Key API-токена R2 — вместе с BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET и BACKUP_ENCRYPTION_KEY включает бэкапы БД. |
| `DATABASE_URL` | **обязательна** | nonEmpty | Строка подключения к Postgres — без неё Prisma не подключается, приложение не работает. |
| `DB_STATEMENT_TIMEOUT_MS` | опциональна | целое 0…2147483647 | Предел одного запроса к базе в миллисекундах (по умолчанию 30 000) — дольше запрос прерывается с ошибкой; 0 выключает предел. Рубильник без выкладки кода (src/prisma/statement-timeout.ts). |
| `DEPLOY_TARGET` | опциональна | oneOf(amvera, vps) | Площадка: «vps» (задаёт deploy/vps/docker-compose.yml) — там pgdata единственная копия базы, и бэкапы в R2 обязательны; не задана или «amvera» — бэкапы платформы, R2 по желанию. |
| `SITE_URL` | опциональна | url | Адрес сайта для ссылок в уведомлениях о записи — дефолт kotlarewski.gr. |
| `STARTUP_CRASHES_DAY` | опциональна | целое ≥ 0 | Падений приложения за сутки в этом контейнере — ставит `deploy/entrypoint.mjs` (`deploy/crash-window.mjs`), вручную не задаётся. Число попадает в DM о перезапуске. |
| `STARTUP_LAUNCH` | опциональна | целое ≥ 1 | Номер запуска приложения внутри контейнера — ставит `deploy/entrypoint.mjs`, вручную не задаётся. 1 — DM «Деплой завершён», больше 1 — DM о перезапуске после падения (`src/telegram/start-announce.ts`). Ручки самого супервизора (`STARTUP_MAX_FAILS`, `STARTUP_MAX_FAILS_HOUR`, `STARTUP_CRASH_WINDOW_MS` и соседи) приложение не читает — они в docs/RUNBOOKS.md, п. «Крашлуп». |
| `STARTUP_NOTICE` | опциональна | 0 или 1 | Троттл DM о старте, который ведёт супервизор (`deploy/crash-window.mjs`): DM о перезапуске уходит, только когда падений за сутки 1, 2, 4, 8… и о таком числе ещё не сообщали; иначе «0» и приложение молчит. Вручную не задаётся. |
| `SUBSCRIPTION_ENABLED` | опциональна | oneOf(true, false) | «true» включает автосписание подписки — выключено, пока автосписание не готово. |
| `WEBAPP_URL` | **обязательна** | httpsUrl | Публичный адрес сайта (schemehappens.ru) — на нём строится колбэк OAuth и фронтенд-редиректы; без него вход через сайт не работает. |

**На VPS пять переменных бэкапов обязательны.** `BACKUP_S3_ENDPOINT`,
`BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`,
`BACKUP_ENCRYPTION_KEY` в таблице «опциональна», потому что на Amvera копии
делает платформа. `BACKUP_S3_REGION` и `BACKUP_RETENTION_DAYS` необязательны и
на VPS. Когда `DEPLOY_TARGET=vps`, их отсутствие: `ops.sh`
(`deploy`, `release-hold`) отказывается запускать приложение и называет недостающие
имена; `checkEnv` в production даёт `error` владельцу в DM и строку в блоке
«Переменные» `/stats`; проба `backupFreshness` отвечает `ok: false`. `DEPLOY_TARGET`
в `PROD_ENV` не кладут: его ставит `docker-compose.yml`.


