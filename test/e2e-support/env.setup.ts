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
// ENCRYPTION_KEY намеренно НЕ задан: вне production src/utils/crypto.ts
// работает в режиме passthrough (шифрование не участвует в проверяемых
// смоуком инвариантах — guard/DTO/ownership).
