import { WORK_TOPICS as BASE_TOPICS } from './topics';
import type { PhaseGuideBuilder } from './types';

const TIMELINE_POINT =
  'Ориентир по числу сессий [Рёдигер, гл. 12]: у более здоровых клиентов после 3–5 сессий рескриптинга идёт 10–15 сессий диалогов на стульях, затем эксперименты. Полный курс — 30–40 сессий до двух лет, затем год ежемесячной поддержки.';

/** Сквозные темы пути с дополнением по гл. 12 Рёдигера к «Техникам во времени». Подменяет WORK_TOPICS в phases/all.ts. */
export const WORK_TOPICS: PhaseGuideBuilder[] = BASE_TOPICS.map(
  (build): PhaseGuideBuilder =>
    (tr) => {
      const g = build(tr);
      if (g.id !== 'techniques_timeline') return g;
      return {
        ...g,
        points: [...(g.points ?? []), TIMELINE_POINT],
        noteIds: [...(g.noteIds ?? []), 'stabilization_first'],
        sources: `${g.sources}, [Рёдигер, гл. 12]`,
      };
    },
);
