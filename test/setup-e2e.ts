// Setup для e2e-прогона (best-practice, 2026-07). crypto-модуль читает
// ENCRYPTION_KEY на этапе загрузки — ставим детерминированный тестовый ключ
// до импорта сервисов (в CI-джобе migrations реального ключа нет, а
// шифрование карточек в read-after-write-тесте должно честно круговертеться).
process.env.ENCRYPTION_KEY ||= '0'.repeat(64);
