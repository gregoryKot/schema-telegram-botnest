# Реестр находок аудита

Журнал всех находок по фазам. Каждая запись: ID, источник, severity (CVSS),
описание, контекст в проекте, статус.

**Статусы:** ✅ Закрыто · 🔧 В работе · ⚠️ Открыто · ❌ Отклонено (false
positive / accepted risk).

---

## Фаза 2 — Автоматическая база (2026-05-20)

Запущенные тулы: `npm audit`, `osv-scanner`, `semgrep` (p/owasp-top-ten,
p/nodejs, p/typescript, p/javascript, p/jwt, p/react), `gitleaks` по всей
истории git (459 коммитов, ~10.5 МБ), кастомные greps по
анти-паттернам из `../SECURITY.md` §8.

**Кастомные greps — чисто:** `Math.random` (0), `fetch` без таймаута (0),
токены в `localStorage` (0), хардкод-секреты в коде (0). `$executeRawUnsafe`:
1 хит — хардкод-строка `VACUUM ANALYZE "User"`, без юзер-инпута (FP).
`JSON.parse` — 7 хитов, **все** обёрнуты в try/catch.

### F-2-01 · Утечка в git-истории README.md ❌ False positive

- **Источник:** `gitleaks` rule `generic-api-key`
- **Severity:** Info
- **Файл/коммит:** `README.md:5` @ `4b64980a` (2026-02-13)
- **Содержимое:** `[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456`
- **Триаж:** строка из стандартного шаблона NestJS README, `abc123def456` —
  буквальный документационный placeholder, не реальный секрет. Не наш репозиторий
  в badge-URL, не наш токен.
- **Статус:** ❌ Отклонено. Опционально: вычистить весь шаблонный NestJS-README,
  оставив только наш контент — заодно успокоит сканер.

### F-2-02 · `qs` 6.14.2 — DoS через `qs.stringify` ✅ Закрыто

- **Источник:** `npm audit` + `osv-scanner` (GHSA-q8mj-m7cp-5q26)
- **Severity:** CVSS 6.3 Medium (upstream) → **Low** в нашем контексте
- **Описание:** `qs.stringify` падает с `TypeError` на null/undefined в
  comma-format массивах при `encodeValuesOnly`.
- **Контекст:** `qs` приходит транзитивно через Express (для `qs.parse`
  на `req.query`). Мы **не вызываем `qs.stringify`** напрямую. Уязвимый путь
  не достигается из нашего кода.
- **Действие:** `npm audit fix` → `qs` 6.14.2 → 6.15.2.
- **Верификация:** `npm audit` после — 0 vulnerabilities.

### F-2-03 · `valibot` 1.0.0-beta.14 — ReDoS в `EMOJI_REGEX` ❌ Не эксплуатируется

- **Источник:** `osv-scanner` (GHSA-vqpr-j7v3-hqw9 / CVE-2025-66020)
- **Severity:** CVSS 7.5 High (upstream) → **Info** в нашем контексте
- **Описание:** `EMOJI_REGEX` валидатора `v.emoji()` имеет catastrophic
  backtracking. Короткая (~99 символов) крафтовая строка из regional indicators
  отжирает CPU на минуты. Если бы наш auth-путь вызывал `v.emoji()` на
  юзер-полях, был бы устойчивый DoS на каждый initData.
- **Контекст:** транзитивная зависимость через
  `@telegram-apps/init-data-node` → `@telegram-apps/transformers` → `valibot`.
  Grep `v\.emoji|emoji\(\)|emoji:` в `node_modules/@telegram-apps/*` — **0
  совпадений**. Уязвимая функция в нашей интеграции не вызывается.
- **Статус:** ❌ Отклонено как не-эксплуатируемое; зависимость уязвима, но путь
  не достигается. Следить за апстримом — когда `@telegram-apps/transformers`
  обновится, vuln уйдёт сама. Альтернатива (если в проекте появится прямой
  `v.emoji()` где-либо): npm `overrides` для пиннинга `valibot >= 1.2.0`.

### F-2-04 · GCM без явного `authTagLength` в `crypto.ts` ✅ Закрыто

- **Источник:** `semgrep` rule `javascript.node-crypto.security.gcm-no-tag-length`
- **Severity:** **Low** (hardening / defense in depth)
- **Файл:** `src/utils/crypto.ts:48` (`createDecipheriv`) — и симметрично
  `:27` (`createCipheriv`).
- **Описание:** Node `createCipheriv`/`createDecipheriv` с GCM по умолчанию
  принимают любую длину auth-тэга из {4, 8, 12, 13, 14, 15, 16} байт. Короткий
  тэг = ослабленная аутентификация (4-байт — 2³² форджей вместо 2¹²⁸).
- **Контекст:** в нашем коде tag всегда `buf.subarray(12, 28)` = 16 байт
  (а `buf.length < 29` отсекается раньше). Эксплуатации сейчас нет, но явный
  опшен закрепляет инвариант — будущий рефактор не сможет случайно его сломать.
- **Действие:** добавил `{ authTagLength: 16 }` в оба вызова.
- **Верификация:** `tsc` чист; round-trip encrypt/decrypt с новым опшеном
  работает; ciphertext бинарно-идентичен — обратная совместимость с уже
  зашифрованными в БД данными подтверждена (decrypt без опшена читает тот же
  ciphertext).

---

## Итог Фазы 2

- 4 находки от автоматики, **0 эксплуатируемых** в нашей интеграции.
- 2 закрыто (F-2-02 `qs`, F-2-04 GCM-hardening), 2 отклонено как FP/неэксплуатируемое.
- После: `npm audit` чист на всех 3 пакетах; `osv-scanner` — только F-2-03 (отслеживается).

Следующая фаза — 3 (архитектурный разбор).

---

## Фаза 3 — Полный аудит проекта (2026-07, PROJECT_AUDIT.md + ADDENDUM)

Ручной аудит архитектуры auth/crypto/authz + БД + инфра + платежи.
Все находки ниже закрыты в PR #27, если не отмечено иное.

### S-1 · Rate-limit обходился ротацией неверифицированного `sub` ✅ Закрыто
- **Severity:** Medium. Троттлинг-бакет строился по JWT `sub`/initData `user.id`
  ДО проверки подписи → свежий бакет на каждый запрос.
- **Фикс:** неверифицированные идентификаторы скованы с IP (`uid|ip`),
  `throttler.guard.ts` + регрессионный spec.

### S-2 · Реестры user-таблиц дублировались без сверки ✅ Закрыто
- **Severity:** Medium (data-loss/retention). `USER_DATA_TABLES` ↔
  `USER_OWNED_TABLES` жили независимо.
- **Фикс:** `table-registry.spec.ts` парсит schema.prisma и роняет тест при
  дрейфе. Сверка сразу вскрыла: EmailToken-сироты после merge (→
  SECURITY_SENSITIVE), непереносимые ModeMap/TherapistCustomMode (→ remap в
  merge()). Чеклист CLAUDE.md дополнен.

### S-3 · decrypt() молчал при провале GCM-аутентификации ✅ Закрыто
- **Фикс:** warning (троттлинг 1/мин) при blob'е в формате шифротекста,
  который не расшифровался ни одним ключом.

### S-4 · link_token в query-параметре ✅ Закрыто
- **Фикс:** httpOnly-cookie `link_token` (60 с, path=/api/auth) как основной
  канал; query — deprecated fallback для старых клиентов.

### S-5 · CI отсутствовал ✅ Закрыто
- **Фикс:** `.github/workflows/ci.yml` — tsc+jest+npm audit (high, prod-deps)
  бэкенда, сборки+vitest фронтендов, проверка актуальности dist миниаппа.

### D-1 · Клинические записи о клиенте переживали удаление его аккаунта ✅ Закрыто
- **Severity:** High (right-to-erasure). `deleteAllUserData` чистил
  ClientConceptualization/TherapistNote только по therapistId.
- **Фикс:** OR [{therapistId},{clientId}] + миграция дочистки сирот
  (20260707000001) + регрессионный spec.

### P-1 · TOCTOU-гонка двойного бронирования слота ✅ Закрыто
- **Фикс:** проверка+create в транзакции под pg_advisory_xact_lock.

### P-2 · Платёжные webhook: check-then-act ✅ Закрыто
- **Фикс:** атомарный CAS (updateMany по статусу) в booking.confirm,
  subscription.markChargePaid, donation.markPaid + спеки идемпотентности.

### P-3 · Возможное двойное recurring-списание ✅ Закрыто
- **Фикс:** chargeDue пропускает подписку со свежим pending-charge + алерт.

### P-4 · Расхождение суммы только алертило ✅ Закрыто (booking) / ❌ Accepted (subs/donations)
- **Фикс:** booking.confirm блокирует авто-подтверждение при mismatch.
  Для подписок/донатов — осознанно только алерт: сумма подписана Robokassa,
  юзер оплатил легитимно выставленный счёт.

### P-5 · book() не валидирует время против AvailabilityRule ⚠️ Открыто (этап 2)

### I-1 · CMD без exec — graceful shutdown не работал ✅ Закрыто
### I-2 · Root, однослойный образ ✅ Закрыто (multi-stage, USER node, npm ci)
### I-3 · Нет health-эндпоинта ✅ Закрыто (/health + HEALTHCHECK)
### I-4 · Троттлинг алертов обходится динамическим текстом ⚠️ Открыто (этап 2)

### Юридика (L-1…L-9) — см. PROJECT_AUDIT_ADDENDUM.md
L-1/L-2/L-4/L-5/L-6(частично)/L-7/L-8 закрыты правками политики, оферты и
согласий (2026-07-07). Открыто: L-3 уведомление РКН (на владельце),
Ю.5 оферта подписки (блокер включения подписки).
