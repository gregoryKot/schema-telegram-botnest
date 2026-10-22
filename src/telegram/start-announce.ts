// DM владельцу о старте приложения — после `app.listen`, а не в onModuleInit.
//
// Раньше «🚀 Деплой завершён» уходил из хвоста TelegramService.onModuleInit:
// при КАЖДОМ старте процесса и ещё до того, как HTTP начал слушать. Крашлуп
// слал его на каждом круге без конца, и владелец видел «деплой прошёл», когда
// прод падал (аудит 2026-10, находка «Супервизор контейнера»). Теперь:
//   - DM уходит только когда сервер уже принимает запросы (зовёт main.ts,
//     пин — start-announce.spec.ts);
//   - первый запуск в контейнере — деплой, следующие — перезапуск после
//     падения, и текст говорит об этом прямо;
//   - частоту решает супервизор (deploy/crash-window.mjs), потому что память
//     процесса приложения после падения чистая: DM о перезапуске только на 1, 2,
//     4, 8… падении за сутки (STARTUP_NOTICE=0 — молчать);
//   - режим переезда бота (BOT_REDIRECT_USERNAME) молчит, как и раньше.
import { Logger, type INestApplicationContext } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { readStartupEnv, type StartupEnv } from './start-launch-env';

const posInt = (raw: string | undefined): number | null => {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 1 ? n : null;
};

/** Текст DM по данным супервизора; нет номера или он битый — обычный старт. */
export function startAnnouncement(env: StartupEnv): string {
  const launch = posInt(env.launch);
  if (!launch || launch === 1) return '🚀 Деплой завершён';
  const crashes = posInt(env.crashes);
  const head = `⚠️ Приложение перезапущено после падения (запуск ${launch} с начала работы контейнера).`;
  const tail = 'Причина — в логах контейнера.';
  if (!crashes) return `${head} ${tail}`;
  return (
    `${head} Падений за сутки: ${crashes}. Следующее такое сообщение — ` +
    `когда их станет ${crashes * 2}. ${tail}`
  );
}

/** Слать ли DM: супервизор не запретил, бот не в режиме переезда. */
export function shouldAnnounce(
  env: StartupEnv,
  redirect: string | undefined,
): boolean {
  return env.notice !== '0' && !redirect;
}

/**
 * Шлёт DM о старте через TelegramService.notifyAdmin (без бота и ADMIN_ID —
 * молчит). Не бросает: main.ts зовёт её после listen, и сбой DM не должен
 * ронять уже поднятый процесс.
 */
export async function announceStart(
  app: INestApplicationContext,
): Promise<boolean> {
  const logger = new Logger('StartAnnounce');
  try {
    const env = readStartupEnv();
    if (!shouldAnnounce(env, process.env.BOT_REDIRECT_USERNAME)) {
      logger.log(
        `start DM skipped (launch=${env.launch}, crashes=${env.crashes})`,
      );
      return false;
    }
    return await app.get(TelegramService).notifyAdmin(startAnnouncement(env));
  } catch (err) {
    logger.error('start DM failed', err);
    return false;
  }
}
