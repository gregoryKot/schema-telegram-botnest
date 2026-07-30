import { PrismaService } from '../prisma/prisma.service';
import { QuickPracticeId } from './practice-sessions.service';

// Маленький чистый хелпер, вынесенный из journey.service.ts (файл близок к
// лимиту размера) — грузит PracticeSession юзера и сразу раскладывает их на
// три ленты «Мой путь» + честные полные счётчики по каждому инструменту.

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
 * journey.service.ts получает результат одним вызовом внутри своего Promise.all. */
export async function loadPracticeJourney(
  prisma: PrismaService,
  userId: bigint,
): Promise<{ items: PracticeJourneyItem[]; counts: PracticeJourneyCounts }> {
  const rows = await prisma.practiceSession.findMany({
    where: { userId },
    select: { id: true, tool: true, createdAt: true },
  });
  const items = rows
    .filter((r): r is typeof r & { tool: QuickPracticeId } => isTool(r.tool))
    .map((r) => ({ type: r.tool, id: r.id, at: r.createdAt.toISOString() }));
  return {
    items,
    counts: {
      breathingSessions: items.filter((i) => i.type === 'breathing').length,
      groundingSessions: items.filter((i) => i.type === 'grounding').length,
      stopSessions: items.filter((i) => i.type === 'stop').length,
    },
  };
}
