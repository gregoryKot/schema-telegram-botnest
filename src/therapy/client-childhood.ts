// «Колесо детства» клиента для терапевта: оценки 0–10 по пяти базовым
// потребностям (таблица ChildhoodRating, пишет BotService.saveChildhoodRatings).
// Холст «Графических карт» кладёт их на колесо потребностей. Отдаём только
// известные потребности (NEED_IDS = NEED_ORDER сайта) и целые 0–10: битая
// строка таблицы не доезжает до кабинета терапевта. Приватность (профиль
// скрыт клиентом, офлайн-карточка) решает getClientData — здесь чтение и фильтр.
import type { PrismaService } from '../prisma/prisma.service';
import { NEED_IDS } from '../bot/bot.service';

const KNOWN_NEEDS: ReadonlySet<string> = new Set(NEED_IDS);

/** needId → оценка; неизвестные потребности и значения вне 0–10 отброшены. */
export function childhoodRatingsOf(
  rows: { needId: string; value: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { needId, value } of rows) {
    if (!KNOWN_NEEDS.has(needId) || !Number.isInteger(value)) continue;
    if (value >= 0 && value <= 10) out[needId] = value;
  }
  return out;
}

export async function readChildhoodRatings(
  prisma: PrismaService,
  userId: bigint,
): Promise<Record<string, number>> {
  const rows = await prisma.childhoodRating.findMany({
    where: { userId },
    select: { needId: true, value: true },
  });
  return childhoodRatingsOf(rows);
}
