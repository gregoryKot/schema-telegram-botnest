// DM владельцу о старте приложения — после `app.listen`, а не в onModuleInit.
//
// Раньше «🚀 Деплой завершён» уходил из хвоста TelegramService.onModuleInit:
// при КАЖДОМ старте процесса и ещё до того, как HTTP начал слушать. Крашлуп
// с прогонами дольше минуты слал его на каждом круге без конца, и владелец
// видел «деплой прошёл», когда прод падал (аудит 2026-10, находка
// «Супервизор контейнера»). Теперь:
//   - DM уходит только когда сервер уже принимает запросы (зовёт main.ts);
//   - номер запуска в контейнере ставит супервизор (deploy/entrypoint.mjs,
//     STARTUP_LAUNCH): первый запуск — деплой, следующие — перезапуск после
//     падения, и текст говорит об этом прямо, а не маскируется под деплой;
//   - частоту ограничивает окно падений супервизора (deploy/crash-window.mjs):
//     не больше STARTUP_MAX_FAILS запусков за серию, паузы между сериями растут.
import { Logger, type INestApplicationContext } from '@nestjs/common';
import { TelegramService } from './telegram.service';

/** Имя переменной; её же пишет deploy/entrypoint.mjs (сверяет maintenance-startup.spec.ts). */
export const STARTUP_LAUNCH_ENV = 'STARTUP_LAUNCH';

/** Текст DM по номеру запуска; нет номера или он битый — обычный старт. */
export function startAnnouncement(launch: string | undefined): string {
  const n = Number(launch);
  if (!launch || !Number.isInteger(n) || n <= 1) return '🚀 Деплой завершён';
  return (
    `⚠️ Приложение перезапущено после падения: запуск ${n} с начала ` +
    'работы контейнера. Причина — в логах контейнера.'
  );
}

/**
 * Шлёт DM о старте через TelegramService.notifyAdmin (без бота и ADMIN_ID —
 * молчит). Не бросает: main.ts зовёт её после listen, и сбой DM не должен
 * ронять уже поднятый процесс.
 */
export async function announceStart(
  app: INestApplicationContext,
): Promise<boolean> {
  try {
    const launch = process.env[STARTUP_LAUNCH_ENV];
    return await app
      .get(TelegramService)
      .notifyAdmin(startAnnouncement(launch));
  } catch (err) {
    new Logger('StartAnnounce').error('start DM failed', err);
    return false;
  }
}
