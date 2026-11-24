import { makeTable, withDefaults } from './fake-prisma-engine';
import { withUpdatedAt } from './fake-updated-at';

/** План работы и путь клиента: значения `@default` схемы, которых фейк не знает. */
export function makePathTables() {
  return {
    therapyPlanItem: withUpdatedAt(
      withDefaults(makeTable(), {
        status: 'planned',
        taskId: null,
        phaseId: null,
      }),
    ),
    therapyPath: withUpdatedAt(
      withDefaults(makeTable(), () => ({ createdAt: new Date() })),
    ),
    therapyPathPhase: withUpdatedAt(
      withDefaults(makeTable(), {
        goal: null,
        note: null,
        startedAt: null,
        endedAt: null,
        criteriaDone: [],
      }),
    ),
  };
}
