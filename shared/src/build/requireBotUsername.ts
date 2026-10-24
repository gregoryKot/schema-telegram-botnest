// Сборочный guard имени бота (аудит 2026-10, infra#18). Раньше botConfig.ts
// подставлял 'SchemaLabBot', если VITE_BOT_USERNAME не задан: прод-сборка без
// переменной молча вшивала в бандл ссылки на старого бота. Теперь пустое
// значение в production-сборке роняет её с понятным сообщением. Один плагин на
// оба фронтенда (webapp, schema-miniapp) — правило №3.

interface ResolvedLike {
  command: string;
  mode: string;
  env: Record<string, string | undefined>;
}

export const BOT_USERNAME_MISSING_MESSAGE =
  'VITE_BOT_USERNAME не задан для production-сборки: ссылки t.me в бандле ' +
  'остались бы без имени бота. Задай его (без @): Dockerfile для webapp, ' +
  'schema-miniapp/.env.production для мини-аппа.';

/** Бросает, только если это production-сборка без имени бота. */
export function assertBotUsernameForBuild(config: ResolvedLike): void {
  if (config.command !== 'build' || config.mode !== 'production') return;
  if (config.env.VITE_BOT_USERNAME?.trim()) return;
  throw new Error(BOT_USERNAME_MISSING_MESSAGE);
}

export function requireBotUsernamePlugin() {
  return {
    name: 'require-bot-username',
    configResolved: assertBotUsernameForBuild,
  };
}
