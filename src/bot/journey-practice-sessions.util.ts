import { QuickPracticeId } from './practice-sessions.service';

// Маленький чистый хелпер, вынесенный из journey.service.ts (файл близок к
// лимиту размера) — раскладывает сырые строки PracticeSession по трём лентам
// «Мой путь» + честные полные счётчики (для каждого инструмента отдельно).

export interface PracticeSessionRow {
  id: number;
  tool: string;
  createdAt: Date;
}

export interface PracticeSessionJourneyItem {
  type: QuickPracticeId;
  id: number;
  at: string;
}

export function mapPracticeSessions(rows: PracticeSessionRow[]): {
  items: PracticeSessionJourneyItem[];
  counts: {
    breathingSessions: number;
    groundingSessions: number;
    stopSessions: number;
  };
} {
  const items = rows
    .filter(
      (r): r is PracticeSessionRow & { tool: QuickPracticeId } =>
        r.tool === 'breathing' || r.tool === 'grounding' || r.tool === 'stop',
    )
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
