// Jest setupFiles (test/jest-e2e.json) — выполняется ДО импорта тестовых
// файлов, а значит и до первого require('../../src/app.module'). Критично:
// ConfigService.getOrThrow('JWT_SECRET'/'BOT_TOKEN') читается в конструкторах
// нескольких провайдеров (см. TelegramOidcProvider) на этапе сборки
// TestingModule — если выставить эти переменные внутри спека ПОСЛЕ import,
// будет поздно.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'e2e-smoke-test-secret';
process.env.BOT_TOKEN = '12345:E2E_SMOKE_TEST_TOKEN';
process.env.WEBAPP_URL = process.env.WEBAPP_URL ?? 'https://schemehappens.ru';
// ENCRYPTION_KEY намеренно НЕ задан здесь: вне production src/utils/crypto.ts
// работает в режиме passthrough (шифрование не участвует в проверяемых
// смоуком инвариантах — guard/DTO/ownership). test/setup-e2e.ts (следующий
// setupFiles-шаг) выставляет детерминированный ключ поверх этого — платёжный
// e2e (payment-webhooks.e2e-spec.ts) намеренно пишет короткие/нелатинские
// строки в фейковую БД напрямую (мимо encryptRecord), которые decrypt()
// пропускает как passthrough (не похожи на ciphertext-формат) — так что оба
// режима безопасны для него.
//
// Robokassa — тестовые пароли (payment-webhooks.e2e-spec.ts пересчитывает
// MD5-подпись теми же паролями, что и RobokassaService.validateWebhook/
// validateSuccess). Реального мерчанта не существует, значения условные.
process.env.ROBOKASSA_MERCHANT_LOGIN ||= 'e2e_shop';
process.env.ROBOKASSA_PASSWORD1 ||= 'e2e_pass1_secret';
process.env.ROBOKASSA_PASSWORD2 ||= 'e2e_pass2_secret';
process.env.ROBOKASSA_IS_TEST ||= 'true';
