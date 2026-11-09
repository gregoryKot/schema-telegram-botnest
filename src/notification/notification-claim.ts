// Захват строки очереди уведомлений до отправки (аудит 2026-10, backend#15).
//
// Аренда прогона очереди (`notificationQueue`, 4 мин) и kill-таймер (4 мин,
// telegram.schedule-queue.budget.ts) снимают лок, но не останавливают прогон:
// зависший на базе прогон дорабатывал свои строки, а следующий тик читал те же
// неотправленные строки — человек получал напоминание дважды. Теперь перед
// отправкой строку забирает один условный UPDATE: из двух прогонов (и двух
// инстансов) строку получает ровно один, второй её пропускает. Атомарность —
// свойство Postgres, доказана на живой базе (test/notification-claim.e2e-spec.ts).
//
// Окно — на случай, когда захвативший процесс упал между захватом и отметкой
// «отправлено»: строка снова доступна через окно. Строку, которая осталась на
// повтор (временный сбой, лимит Telegram, кончился бюджет прогона), очередь
// отпускает сама — releaseClaim, повтор не ждёт окна.
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Окно захвата. Больше kill-таймера плюс период крона (4 + 5 мин): прогон,
 * брошенный kill-таймером, держит свою строку и на следующем тике. Меньше —
 * незачем: упавший процесс задержит строку не дольше двух тиков.
 */
export const CLAIM_WINDOW_MS = 10 * 60_000;

type Db = Pick<PrismaService, '$executeRaw'>;

/**
 * true — строка теперь наша: не отправлена, не снята, никем не взята (или
 * взята дольше окна назад). Один UPDATE с условием: из параллельных вызовов
 * строку получает ровно один — второй ждёт блокировки строки и перепроверяет
 * условие на закоммиченной версии. Число строк, а не RETURNING: колонки ответа
 * драйверу читать не нужно (как у claimRun, cron-leader.service.ts).
 */
export async function claimForSend(
  prisma: Db,
  id: number,
  now: Date = new Date(),
  windowMs: number = CLAIM_WINDOW_MS,
): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - windowMs);
  const claimed = await prisma.$executeRaw`
    UPDATE "ScheduledNotification" SET "attemptedAt" = ${now}
     WHERE "id" = ${id} AND "sentAt" IS NULL AND "cancelledAt" IS NULL
       AND ("attemptedAt" IS NULL OR "attemptedAt" < ${staleBefore})
  `;
  return claimed === 1;
}
