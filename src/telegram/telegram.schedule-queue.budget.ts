// Сколько может длиться один прогон очереди уведомлений. Вынесено из
// telegram.schedule-queue.ts (правило №10).
//
// Бюджет прогона строго меньше kill-switch: после kill-switch лок снимается,
// и следующий тик пошёл бы параллельно — дубли напоминаний. И меньше окна
// аренды LEASE_WINDOW.fiveMinutes (4 мин, src/infra/cron-leader.service.ts),
// иначе тот же тик забрал бы второй инстанс. Бюджет проверяется перед каждой
// отправкой, поэтому худший прогон — бюджет плюс одна отправка (15 с,
// SEND_TIMEOUT_MS). Соотношение пинит telegram.schedule-queue.pace.spec.ts.
import type { Logger } from '@nestjs/common';

export const QUEUE_TICK_BUDGET_MS = 3 * 60_000;
export const QUEUE_KILL_SWITCH_MS = 4 * 60_000;

/** Kill-switch: снять лок, если прогон завис дольше следующего тика. */
export function armQueueKillSwitch(
  logger: Logger,
  release: () => void,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    logger.error('processQueue timed out after 4 min — releasing lock');
    release();
  }, QUEUE_KILL_SWITCH_MS);
}
