# Всё по схеме / SchemeHappens

Приложение самопомощи по схема-терапии: трекер потребностей, дневники схем и
режимов, тест YSQ, практики, кабинет терапевта. Один бэкенд на NestJS + один
фронтенд.

- **Сайт** — [schemehappens.ru](https://schemehappens.ru) (`webapp/`, логин Telegram/VK/MAX/почта, JWT). Кнопки бота в Telegram и MAX открывают этот же сайт (кабинет `/today`, вход по подписи мессенджера); старый адрес `/app/*` отвечает 302 в `/today`.
- **Telegram-бот** — уведомления, трекер, онбординг (`src/telegram/`)

Данные общие: если `userId` совпадает, сайт, Telegram и MAX показывают одно и то же.

## Стек

NestJS · Prisma · PostgreSQL · Telegraf · React + Vite (фронтенд) ·
Jest (бэкенд) · Vitest (фронтенд) · деплой на Amvera.

## Структура

| Путь | Что внутри |
|---|---|
| `src/bot/` | бизнес-логика (потребности, оценки, БД) |
| `src/telegram/` | команды, кнопки, провайдер бота |
| `src/therapy/` | кабинет терапевта, концептуализации, задания |
| `src/auth/` | JWT, initData, merge аккаунтов |
| `src/booking/`, `src/subscription/`, `src/donation/` | запись на консультации, платежи |
| `src/analytics/` | продуктовые события и метрики |
| `webapp/` | фронтенд (сайт и кабинет) |
| `shared/` | общий код фронтенда |
| `prisma/` | схема БД и миграции |
| `scripts/` | CI-гейты и храповики |
| `docs/` | документация ([оглавление](docs/README.md)) |

## Разработка

```bash
npm ci
npx prisma generate
npm run start:dev                      # бэкенд
npm run build --prefix webapp          # сборка сайта
```

## Проверки перед коммитом

```bash
npx tsc --noEmit -p tsconfig.build.json
npx jest
npx eslint src --quiet
```

CI гоняет джобы `backend`, `migrations` (реальный Postgres), `webapp`
и `eslint`, плюс храповики размера файлов, дублей и покрытия.
**Ничего не мержится с красным CI** — правило №1 в [CLAUDE.md](CLAUDE.md).

## Деплой

`git push origin main` — Amvera сама тянет из GitHub и пересобирает.
Отдельный push в remote `amvera` не нужен.

Сайт собирает Docker; `dist` в git нет.

## Документация

Правила проекта, обязательные к соблюдению, — в [CLAUDE.md](CLAUDE.md) (по строке
на правило; полные тексты — в [.claude/rules/](.claude/rules/)). Карта кода —
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Остальное — в [docs/](docs/README.md).
