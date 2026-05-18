# Правила проекта

## Структура

- `src/bot/` — бизнес-логика (потребности, оценки, БД)
- `src/telegram/` — всё связанное с Telegram (команды, кнопки, провайдер бота)
- `src/prisma/` — PrismaService, подключение к БД

## Два фронтенда — один бэк

- `webapp/` — сайт `schemalab.ru` (логин Google/Telegram, JWT)
- `schema-miniapp/` — Telegram мини-апп `schemalab.ru/app/` (initData)
- Оба ходят в один NestJS API. Данные **общие** если `userId` совпадает.

Когда совпадает:
- Telegram login на сайте ⇄ мини-апп = один и тот же `userId = telegramId` ✓
- Google login на сайте → отдельный web-only `userId`. Чтобы данные подтянулись из мини-аппа — юзеру надо в `/account` нажать "Привязать Telegram" и потвердить merge.

См. `src/auth/merge.service.ts` — транзакционный перенос userId по всем USER_OWNED_TABLES при подтверждённом merge.

**Новая функциональность** → сначала логика в `bot.service.ts`, потом UI в `telegram.service.ts`.
Не смешивай Telegram-логику с бизнес-логикой.

## Файлы

- Максимум ~150 строк на файл. Если больше — выноси в отдельный сервис.
- Не создавай новые файлы без необходимости. Один сервис = один файл.
- Не дублируй провайдеры: `PrismaModule` глобальный, не регистрируй `PrismaService` в других модулях.

## Обработка ошибок

- **Все** Telegram-хендлеры (команды и action) обёрнуты в `try/catch`.
- `answerCbQuery()` вызывается **до** обращения к БД или внешним сервисам — иначе Telegram покажет вечный спиннер.
- Если `editMessageText` / `reply` могут упасть внутри catch, добавляй `.catch(() => null)`.
- Ошибки логируются через `this.logger.error(...)`, не через `console.log`.

## Безопасность

- Все env-переменные читаются через `ConfigService` или `process.env` — не хардкодить значения.
- Данные из callback_data (needId, value) всегда валидируются перед использованием.
- Команды с побочными эффектами (например `/post`) защищены проверкой `ADMIN_ID`.

## Telegram

- Переходы между экранами — `editMessageText`, не `reply` (не засорять чат).
- Callback data формат: `действие:параметр` (например `need:safety`, `rate:safety:7`).
- Константы (`CHANNEL`, `BOOKING_URL`) — в начале файла, не inline в коде.

## БД

- Схема: `prisma/schema.prisma`. После изменений — `prisma migrate dev --name <название>`.
- На Railway миграции применяются автоматически через `start:prod`.

## Новая таблица с пользовательскими данными — обязательный чеклист

При добавлении любой модели с полем `userId` **обязательно** выполнить все 4 шага:

**1. Удаление при удалении аккаунта**
Добавить имя модели в `USER_DATA_TABLES` в начале `src/bot/bot.service.ts`.
Это единственное место — `deleteAllUserData` автоматически очистит её.
TypeScript проверит что имя корректно (тип `_VerifyTables`).

**2. Шифрование**
Объявить `EncryptSchema` рядом с методами модели:
```typescript
const MY_SCHEMA: EncryptSchema = { strings: ['text', 'note'], jsonArrays: ['items'] };
```
Использовать `encryptRecord(data, MY_SCHEMA)` при записи и `decryptRecord(row, MY_SCHEMA)` при чтении.
Не шифровать: `id`, `userId`, `createdAt`, `updatedAt`, типы-перечисления (modeId, schemaId, needId).

**3. Каскадное удаление в Prisma**
```prisma
user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
```

**4. После изменений схемы**
```bash
npx prisma generate
```
