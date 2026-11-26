// Бюджет восстановлений потерянного ответа ротации (аудит 2026-10, High).
//
// `recover` (refresh-rotation.ts) выдаёт НОВУЮ пару тому, кто предъявил уже
// ротированный токен, если его наследник жив и не тронут. Без счётчика этим
// пользуются ДВОЕ по очереди: у вора R0, у жертвы R1 (R0→R1). Вор предъявляет
// R0 → recover, R1 убит, вору R2. Жертва предъявляет R1 → отозван, наследник
// R2 жив → recover, жертве R3 (R2 убит). Вор предъявляет R2 → recover → R4 …
// Оба вечно держат живые токены, `theft` не срабатывает, алерта нет.
//
// Легитимных причин для `recover` две — потерянный ответ и поздний ответ
// старой ротации, — и каждая даёт не больше ДВУХ восстановлений подряд, после
// чего цепочка снова линейна. Поэтому считаем восстановления семьи за сутки
// (строки с `recoveredAt`) и третье признаём кражей.
import type { PrismaService } from '../prisma/prisma.service';
import type { ReuseVerdict } from './refresh-rotation';

export const RECOVER_WINDOW_MS = 24 * 3600_000;
export const RECOVER_MAX_PER_WINDOW = 2;

/** Сколько восстановлений в семье уже было за окно. */
export function countRecentRecoveries(
  prisma: Pick<PrismaService, 'webSession'>,
  family: string,
  now: Date,
): Promise<number> {
  return prisma.webSession.count({
    where: {
      family,
      recoveredAt: { gte: new Date(now.getTime() - RECOVER_WINDOW_MS) },
    },
  });
}

/**
 * Вердикт с учётом бюджета: `recover` при исчерпанном бюджете становится
 * `theft`, остальные исходы не трогаем.
 */
export function applyRecoverBudget(
  verdict: ReuseVerdict,
  recentRecoveries: number,
  userId: bigint,
): ReuseVerdict {
  if (
    verdict.outcome !== 'recover' ||
    recentRecoveries < RECOVER_MAX_PER_WINDOW
  ) {
    return verdict;
  }
  return {
    outcome: 'theft',
    logMessage: `Refresh token reuse detected — третье восстановление за сутки — второй участник цепочки, revoking family (userId ${String(userId)})`,
  };
}
