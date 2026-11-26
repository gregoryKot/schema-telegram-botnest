import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

// Стрик и день последней оценки для списка клиентов терапевта — одним
// запросом, без потолка строк. До 2026-11 сервис грузил пары «человек–день»
// по ВСЕМ клиентам разом с `take: 5000`: при 50 клиентах, заполняющих каждый
// день, это ≈100 дней на человека, и длинный стрик молча обрезался
// (docs/open/backend.md, класс обрезки ядра /stats).
//
// Стрик — подряд идущие дни, кончающиеся сегодняшним днём КЛИЕНТА (`today`
// приходит из сервиса, по его notifyTimezone). Gaps-and-islands: дни не
// позже сегодня по убыванию с номером rn от нуля; день входит в стрик, пока
// он ровно «сегодня − rn». После первой дыры разница только растёт, поэтому
// счёт таких дней и есть длина стрика. Хранимый `date` не кастуется в date:
// сравнение текстом `YYYY-MM-DD`, кастуется только `today` из кода.
// Живая проверка — test/raw-sql-live-infra.e2e-spec.ts (правило №18).
export interface ClientStreak {
  streak: number;
  lastDate: string | null; // max(date), в том числе «завтра» другой зоны
}

interface Row {
  userId: bigint;
  lastDate: string | null;
  streak: number;
}

export async function readClientStreaks(
  prisma: Pick<PrismaService, '$queryRaw'>,
  todayByUser: ReadonlyMap<bigint, string>,
): Promise<Map<string, ClientStreak>> {
  const out = new Map<string, ClientStreak>();
  if (todayByUser.size === 0) return out;
  const ids = [...todayByUser.keys()];
  const todays = ids.map((id) => todayByUser.get(id) as string);
  // По клиенту: обратный проход по индексу (userId, date) — дни уже по
  // убыванию, без сортировки; MAX(date) — одна запись того же индекса.
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT t.uid AS "userId",
      (SELECT MAX(r."date") FROM "Rating" r WHERE r."userId" = t.uid) AS "lastDate",
      (SELECT COUNT(*) FROM (
        SELECT x.day, ROW_NUMBER() OVER (ORDER BY x.day DESC) - 1 AS rn
        FROM (
          SELECT DISTINCT r."date" AS day FROM "Rating" r
          WHERE r."userId" = t.uid AND r."date" <= t.today
          ORDER BY r."date" DESC
        ) x
      ) y WHERE y.day = to_char(t.today::date - y.rn::int, 'YYYY-MM-DD'))::int AS streak
    FROM unnest(${ids}::bigint[], ${todays}::text[]) AS t(uid, today)`);
  for (const r of rows)
    out.set(String(r.userId), { streak: r.streak, lastDate: r.lastDate });
  return out;
}
