// Чтение payload из `/start <payload>`.
//
// Инцидент, найденный разбором авторизации 2026-08-28. Telegraf 4.16 кладёт
// payload в `ctx.payload` у ЛЮБОЙ команды (`Composer.command`,
// lib/composer.js:381), а `ctx.startPayload` проставляет ТОЛЬКО
// `Composer.start` (lib/composer.js:116). Хендлер зарегистрирован через
// `bot.command('start', …)`, поэтому `startPayload` в проде всегда
// `undefined` — и ветки `src_…` (атрибуция посевов) и `pair_…` (приглашение
// в пару) молча не работали.
//
// Тесты этого не ловили: поддельный ctx подставлял поле руками, то есть
// кодировал допущение вместо проверки. Предусловие в проде создаёт ЧУЖОЙ код
// (telegraf), значит тест обязан пройти через него — правило №14 CLAUDE.md,
// см. `start-payload.seam.spec.ts`.
//
// Читаем оба поля: `payload` — то, что реально приходит; `startPayload` — на
// случай, если регистрацию когда-нибудь переведут на `bot.start()`.
export function readStartPayload(ctx: {
  payload?: unknown;
  startPayload?: unknown;
}): string | undefined {
  const raw = ctx.payload ?? ctx.startPayload;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}
