-- S16 (аудит 2026-11): почта открытым текстом в "User"."firstName".
-- Колонка не шифруется — реестр считает её публичным именем
-- (src/utils/encryption-policy.ts). Но вход через Google без имени клал туда
-- адрес почты целиком, а вход по почте — часть адреса до @. Код больше так не
-- делает (google.provider.ts, email-token.service.ts, замок в
-- AuthService.findOrCreateUserByProvider); миграция чистит уже записанное.
--
-- Не трогается: полное имя Google (claim name) и фамилия VK в старых строках —
-- по строке не отличить «Иван Петров» от двойного имени, а угадывание стёрло бы
-- настоящие имена. Новые входы пишут только имя (given_name / first_name).
-- Имя Telegram, случайно совпавшее с частью адреса, вернёт бот при следующем
-- /start (AccountService.registerUser обновляет firstName).
--
-- Пустое имя — NULL, а не '': показ падает на «Профиль»/«—» через `??`.
-- Идемпотентна целиком: повторный прогон ничего не находит.

-- 1. Адрес почты целиком (та же форма, что isValidEmail в auth.service.ts).
UPDATE "User"
SET "firstName" = NULL
WHERE "firstName" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';

-- 2. Часть адреса до @ у входа по почте. providerId email-провайдера — сам
-- адрес открытым (лукап-ключ, encryption-policy.ts), его и сравниваем.
UPDATE "User" u
SET "firstName" = NULL
FROM "AuthProvider" ap
WHERE ap."userId" = u."id"
  AND ap."provider" = 'email'
  AND u."firstName" IS NOT NULL
  AND lower(u."firstName") = lower(split_part(ap."providerId", '@', 1));
