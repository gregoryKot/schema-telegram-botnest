// Окно свежести initData Telegram, секунды. Читает его один верификатор,
// auth/telegram-init-data.ts, — а им пользуются гард (init-data-paths.ts), бакет
// лимита (throttler-init-data.ts) и POST /telegram/webapp (auth.service.ts).
// Расхождение окон — дыра: подпись, уже отвергнутую гардом как старую, счётчик
// считал бы «проверенной» (аудит 2026-10, B2).
export const INIT_DATA_MAX_AGE_S = 3600;
