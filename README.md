# Всё по схеме / SchemeHappens

Приложение самопомощи по схема-терапии: трекер потребностей, дневники схем и
режимов, тест YSQ, практики, кабинет терапевта. Один бэкенд на NestJS + два
фронтенда.

- **Сайт** — [schemehappens.ru](https://schemehappens.ru) (`webapp/`, логин Google/Telegram, JWT)
- **Telegram мини-апп** — `schemehappens.ru/app/` (`schema-miniapp/`, авторизация по initData)
- **Telegram-бот** — уведомления, трекер, онбординг (`src/telegram/`)

Данные общие: если `userId` совпадает, сайт и мини-апп показывают одно и то же.

## Стек

NestJS · Prisma · PostgreSQL · Telegraf · React + Vite (оба фронтенда) ·
Jest (бэкенд) · Vitest (фронтенды) · деплой на Amvera.

## Структура

| Путь | Что внутри |
|---|---|
| `src/bot/` | бизнес-логика (потребности, оценки, БД) |
| `src/telegram/` | команды, кнопки, провайдер бота |
| `src/therapy/` | кабинет терапевта, концептуализации, задания |
| `src/auth/` | JWT, initData, merge аккаунтов |
| `src/booking/`, `src/subscription/`, `src/donation/` | запись на консультации, платежи |
| `src/analytics/` | продуктовые события и метрики |
| `webapp/`, `schema-miniapp/` | фронтенды |
| `shared/` | общий код обоих фронтендов |
| `prisma/` | схема БД и миграции |
| `scripts/` | CI-гейты и храповики |
| `docs/` | документация ([оглавление](docs/README.md)) |

## Разработка

```bash
npm ci
npx prisma generate
npm run start:dev                      # бэкенд
npm run build --prefix webapp          # сборка сайта
npm run build --prefix schema-miniapp  # сборка мини-аппа (dist коммитится!)
```

## Проверки перед коммитом

```bash
npx tsc --noEmit -p tsconfig.build.json
npx jest
npx eslint src --quiet
```

CI гоняет джобы `backend`, `migrations` (реальный Postgres), `webapp`,
`miniapp` и `eslint`, плюс храповики размера файлов, дублей и покрытия.
**Ничего не мержится с красным CI** — правило №1 в [CLAUDE.md](CLAUDE.md).

## Деплой

`git push origin main` — Amvera сама тянет из GitHub и пересобирает.
Отдельный push в remote `amvera` не нужен.

⚠️ `schema-miniapp/dist/` **коммитится в git** (Docker его только копирует).
Меняешь исходник мини-аппа — пересобери и закоммить `dist`.

## Документация

Правила проекта, обязательные к соблюдению, — в [CLAUDE.md](CLAUDE.md).
Остальное — в [docs/](docs/README.md).
