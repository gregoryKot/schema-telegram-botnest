// Сценарий пути клиента — к scenarios-therapy.ts (правило №10). Синтетика —
// seed-path.ts; худший случай — клиент с самой длинной историей.
import { BotClientOverviewService } from '../../src/bot/bot.client-overview.service';
import { TherapyPathService } from '../../src/therapy/therapy-path.service';
import { TherapyRelationsService } from '../../src/therapy/therapy-relations.service';
import type { Scenario } from './scenarios';

export const PATH_SCENARIOS: Scenario[] = [
  {
    name: 'therapist-path',
    title: 'Путь клиента (GET /api/therapy/path/:clientId)',
    // Путь пары по (therapistId, clientId) и его фазы по (pathId, position).
    run: async ({ prisma, therapistId, heavyClientId }) => {
      const path = await new TherapyPathService(
        prisma,
        new TherapyRelationsService(
          prisma,
          new BotClientOverviewService(prisma),
        ),
      ).get(therapistId, heavyClientId);
      if (!path || path.phases.length < 8) {
        throw new Error('therapist-path: у пары нет пути с фазами');
      }
      return path;
    },
  },
];
