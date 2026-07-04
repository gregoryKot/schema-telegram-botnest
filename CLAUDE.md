# Правила проекта

## Структура

- `src/bot/` — бизнес-логика (потребности, оценки, БД)
- `src/telegram/` — всё связанное с Telegram (команды, кнопки, провайдер бота)
- `src/prisma/` — PrismaService, подключение к БД

## Два фронтенда — один бэк

- `webapp/` — сайт `schemehappens.ru` (логин Google/Telegram, JWT)
- `schema-miniapp/` — Telegram мини-апп `schemehappens.ru/app/` (initData)
- Оба ходят в один NestJS API. Данные **общие** если `userId` совпадает.

Когда совпадает:
- Telegram login на сайте ⇄ мини-апп = один и тот же `userId = telegramId` ✓
- Google login на сайте → отдельный web-only `userId`. Чтобы данные подтянулись из мини-аппа — юзеру надо в `/account` нажать "Привязать Telegram" и потвердить merge.

См. `src/auth/merge.service.ts` — транзакционный перенос userId по всем USER_OWNED_TABLES при подтверждённом merge.

**Новая функциональность** → сначала логика в `bot.service.ts`, потом UI в `telegram.service.ts`.
Не смешивай Telegram-логику с бизнес-логикой.

## Обращение «ты/вы» (ОБЯЗАТЕЛЬНО для любых новых текстов)

У пользователя есть выбор формы обращения — поле `User.addressForm` (`'ty' | 'vy'`,
дефолт при `null` = «ты»). Выбор делается при первом входе и меняется в настройках.
Действует **везде**: бот, уведомления, мини-апп, сайт. Данные общие — форма едина.

**Правило: каждая новая user-facing строка с обращением обязана звучать в обеих формах.**
Пользователь с формой «вы» не должен нигде увидеть «ты» (и наоборот).

Как разводить (что различается: местоимения ты/тебя/тебе/тобой, притяжательные
твой/…, глаголы 2 л. ед.ч., императивы `Отметь`→`Отметьте`):

- **Бот / уведомления** (бэкенд): `src/notification/address-form.ts` → `t(form, 'ты-текст', 'вы-текст')`.
  Тексты уведомлений уже полностью двухформенные, ориентируйся на них.
- **Фронтенды** (React): хук `useTr()` один раз в теле компонента → `const tr = useTr();`,
  затем `tr('ты-вариант', 'вы-вариант')`. Ещё есть `useAddressForm(): 'ty'|'vy'`,
  `useSetAddressForm()`, и чистый `pickForm(form, ty, vy)` для не-React мест.
  Инфраструктура — `schema-miniapp/src/utils/addressForm.tsx` и `webapp/src/utils/addressForm.tsx`.
- **Контент-файлы** (`needData.ts`, `aboutData.ts` и подобные `*Data.ts` с текстом):
  паттерн «билдер от формы» — `export const buildX = (tr) => (…)` где каждая различающаяся
  строка обёрнута в `tr('ты','вы')`, плюс хук-обёртка `useX() = getX(useAddressForm())`.
  Консьюмеры берут данные через `useX()`, а не импортируют константу напрямую.

Что **не** разводить (оставлять как есть):
- нейтральные/безличные/номинативные строки (названия, эмодзи, теги, 1-е лицо «я …»);
- дословные внутренние цитаты (`«…»`, `"…"`) — межличностная речь и самоподдержка,
  сохраняют свой регистр;
- сугубо клинические описания-убеждения, где «вы плохи» звучит нелепо — их лучше
  перефразировать **безлично** (form-agnostic), чем городить вилку.

Проверка перед коммитом: прогнать по обоим `src` grep-свип на остаточные «ты»-формы
(`[Тт]ы`, `[Тт]еб[еяё]`, `[Тт]во[йяеё]`, окончания `ешь/аешь/ишь`), убедиться что
осталось только осознанно-нейтральное/цитаты. Лендинг/статьи/игра сайта — маркетинг,
не привязаны к `addressForm`, их не трогаем.

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

> Полный security-плейбук — модель угроз, инварианты аутентификации/авторизации,
> анти-паттерны, чеклист перед деплоем, реагирование на инциденты — в [SECURITY.md](SECURITY.md).
> Читать перед изменением auth/api/therapy-кода.

- Все env-переменные читаются через `ConfigService` или `process.env` — не хардкодить значения.
- Данные из callback_data (needId, value) всегда валидируются перед использованием.
- Команды с побочными эффектами (например `/post`) защищены проверкой `ADMIN_ID`.

### Критичные env-переменные
- `BOT_TOKEN` — токен бота. При компрометации: revoke в BotFather → новый токен → инвалидирует ВСЕ initData (юзеры в мини-аппе будут разлогинены, пройдут заново)
- `JWT_SECRET` — подпись access/refresh/merge токенов. При компрометации: ротация → все сессии (web) инвалидируются, merge-токены становятся бесполезны. Юзерам надо залогиниться заново.
- `ENCRYPTION_KEY` — шифрует свободный текст (заметки, дневники, письма, безопасное место). **Никогда не ротируй без re-encryption миграции** — иначе все зашифрованные данные превратятся в мусор. План ротации:
  1. Добавить второй ключ `ENCRYPTION_KEY_NEW`
  2. При чтении пробовать оба ключа (decryptRecord fallback)
  3. Прогнать скрипт: расшифровать всё старым ключом, зашифровать новым, переписать в БД
  4. Удалить старый ключ
- `GOOGLE_CLIENT_SECRET` — клиентский секрет для OAuth. Ротация в Google Cloud Console + обновление env.
- `ADMIN_ID` — Telegram ID единственного администратора. Все админские callback'и проверяют по нему.

### Аудит-события
`SecurityLogService` пишет в логи + DM админу при: merge_confirmed, role_changed, therapist_request_submitted, csrf_blocked, suspicious_initdata (попытка подделать подпись). Если приходит много suspicious_initdata — атака или ротация BOT_TOKEN не докатилась.

### Резервные копии БД (важно для шифрования при компрометации)
Поля в БД зашифрованы AES-256-GCM с ключом из env `ENCRYPTION_KEY`. **Если утечёт бэкап Amvera CNPG + env-snapshot одновременно — данные открыты**.

Что нужно от Amvera (запросить у их саппорта):
1. Шифруются ли резервные копии CNPG at-rest?
2. Где они хранятся (в том же ДЦ, отдельно, у третьей стороны)?
3. Кто имеет к ним доступ (только владелец проекта или сотрудники Amvera)?
4. Encryption keys для бэкапов — ваши или Amvera управляет?

Долгосрочные меры (если хочется паранойи):
- ENCRYPTION_KEY держать **не в env**, а в отдельном secret manager / HSM (для Amvera маловероятно).
- Делать собственные офлайн encrypted dumps (`pg_dump | openssl enc -aes-256-gcm`) и хранить в другом облаке.
- Принять что для российского небольшого хостинга это accepted risk.

### Ротация ENCRYPTION_KEY
1. Сгенерить новый ключ: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. В Amvera env: `ENCRYPTION_KEY_OLD = <старый>`, `ENCRYPTION_KEY = <новый>`. Restart.
3. Запустить `npm run rotate-encryption` (через Amvera exec/SSH).
4. Убрать `ENCRYPTION_KEY_OLD`. Restart.

`decrypt()` поддерживает несколько ключей одновременно — старые читаются как fallback, новые записываются всегда current ключом.

### Удаление аккаунта
`deleteAllUserData` теперь **hard delete** (не soft с deletedAt-флагом):
- DELETE по всем USER_DATA_TABLES + AuthProvider + WebSession + TherapistRequest + сам User
- После транзакции триггер `VACUUM ANALYZE` (не FULL, не блокирует) → быстрее освобождает dead tuples
- Юзер удалён логически мгновенно. Физическое освобождение страниц Postgres'ом — через autovacuum в течение часов.

Для строгого GDPR-уровня right-to-erasure нужен ещё `VACUUM FULL` (лочит таблицы) или disk-level encryption. Не делаем, accepted risk.

## Telegram

- Переходы между экранами — `editMessageText`, не `reply` (не засорять чат).
- Callback data формат: `действие:параметр` (например `need:safety`, `rate:safety:7`).
- Константы (`CHANNEL`, `BOOKING_URL`) — в начале файла, не inline в коде.

## Новый fullscreen-лист или оверлей в webapp (ОБЯЗАТЕЛЬНО)

Любой компонент с `position: fixed, inset: 0` (sheet, экран упражнения, оверлей) **обязан** использовать хук `useHistorySheet` — иначе кнопка «Назад» в браузере уведёт пользователя из приложения.

```tsx
import { useHistorySheet } from '../hooks/useHistorySheet'; // путь от компонента

export function MySheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  // ...
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, ... }}>
      <button onClick={goBack}>Назад</button>   {/* НЕ onClick={onClose} */}
    </div>
  );
}
```

Правила:
- Хук вызывается **один раз** в теле компонента, принимает функцию закрытия (`onClose` / `onBack` / `onDone`).
- Все кнопки «Назад» и «Закрыть» внутри листа используют `goBack()`, **не** `onClose()` напрямую.
- Если лист закрывается после сохранения (`await api.save(); goBack()`), тоже `goBack()`.
- Исключение: внутренние мини-модалки поверх листа (тёмный backdrop для подтверждения) — у них свой локальный `onClose`, хук там не нужен.

**Важно — не использовать `history.pushState` или `window.addEventListener('popstate')` напрямую.**
Хук работает через `useNavigate`/`useLocation` из react-router-dom. Прямой вызов `history.pushState` конфликтует с React Router: при нажатии «Назад» срабатывают оба обработчика одновременно — лист закрывается И роутер уходит на предыдущий раздел.

## Деплой webapp

`webapp/dist/` **не хранится в git** — Amvera сама собирает webapp из исходников через
`RUN npm run build --prefix webapp` в `Dockerfile`.

**Деплой = push в GitHub (`origin/main`). Amvera сама тянет из GitHub и пересобирает** —
отдельный `git push amvera` НЕ нужен. Просто `git push origin main`.

### Мини-апп (`schema-miniapp/`) — важно
Собирается **НЕ** в Docker, а заранее: его `dist/` **коммитится в git**, а Dockerfile
только копирует его в `webapp/dist/app/` (быстрая сборка, без лишнего install/build).
Исходник мини-аппа тоже в git. При изменении исходника мини-аппа:

```bash
npm run build --prefix schema-miniapp   # пересобрать dist
git add schema-miniapp/dist && git commit ...   # закоммитить dist
```

`.dockerignore` исключает исходник мини-аппа из Docker-контекста — поэтому собрать его
в Docker нельзя, только копировать готовую `dist`. Не переключай Dockerfile на сборку
мини-аппа — билд упадёт («Could not resolve entry module index.html»).

Локальная сборка webapp для проверки ошибок TypeScript/Vite:

```bash
cd webapp && node_modules/.bin/vite build
```

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
