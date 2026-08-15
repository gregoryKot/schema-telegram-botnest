import { PrismaService } from '../prisma/prisma.service';
import {
  QUICK_PRACTICE_IDS,
  QuickPracticeId,
} from './practice-sessions.service';

// Маленький чистый хелпер, вынесенный из journey.service.ts (файл близок к
// лимиту размера) — грузит PracticeSession юзера и сразу раскладывает их на
// три ленты «Мой путь» + честные полные счётчики по каждому инструменту.
// Счётчики — через groupBy (без загрузки строк в память), лента — bounded
// findMany (take), тем же приёмом, что и остальные тяжёлые источники в
// journey.service.ts.

export interface PracticeJourneyItem {
  type: QuickPracticeId;
  id: number;
  at: string;
}

export interface PracticeJourneyCounts {
  breathingSessions: number;
  groundingSessions: number;
  stopSessions: number;
}

const isTool = (t: string): t is QuickPracticeId =>
  t === 'breathing' || t === 'grounding' || t === 'stop';

/** Грузит прохождения быстрых практик и сразу отдаёт готовые items/counts —
 * journey.service.ts получает результат одним вызовом внутри своего Promise.all.
 * limit — потолок ленты (FEED_LIMIT); счётчики полные независимо от него. */
export async function loadPracticeJourney(
  prisma: PrismaService,
  userId: bigint,
  limit: number,
): Promise<{ items: PracticeJourneyItem[]; counts: PracticeJourneyCounts }> {
  const [groups, rows] = await Promise.all([
    prisma.practiceSession.groupBy({
      by: ['tool'],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.practiceSession.findMany({
      where: { userId, tool: { in: [...QUICK_PRACTICE_IDS] } },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true, tool: true, createdAt: true },
    }),
  ]);
  const byTool = new Map(groups.map((g) => [g.tool, g._count._all]));
  const items = rows
    .filter((r): r is typeof r & { tool: QuickPracticeId } => isTool(r.tool))
    .map((r) => ({ type: r.tool, id: r.id, at: r.createdAt.toISOString() }));
  return {
    items,
    counts: {
      breathingSessions: byTool.get('breathing') ?? 0,
      groundingSessions: byTool.get('grounding') ?? 0,
      stopSessions: byTool.get('stop') ?? 0,
    },
  };
}
