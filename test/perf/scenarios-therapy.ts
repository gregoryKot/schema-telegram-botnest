// Сценарии кабинета терапевта сверх списка клиентов (scenarios.ts, правило
// №10): бывший терапевт у клиента, заметки сессий и карточка клиента. Худший
// случай — worst-case-therapy.ts, синтетика — seed-therapy.ts. Проверка в
// каждом сценарии ловит синтетику, на которой код ушёл бы короткой веткой.
import { BotAnalyticsService } from '../../src/bot/bot.analytics.service';
import { BotClientOverviewService } from '../../src/bot/bot.client-overview.service';
import { NotificationService } from '../../src/notification/notification.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { getFormerTherapistInfo } from '../../src/therapy/former-therapist-info';
import { TherapyClientDataService } from '../../src/therapy/therapy-client-data.service';
import { TherapyNotesService } from '../../src/therapy/therapy-notes.service';
import { TherapyRelationsService } from '../../src/therapy/therapy-relations.service';
import { PATH_SCENARIOS } from './scenarios-path';
import type { Scenario } from './scenarios';

const relations = (prisma: PrismaService) =>
  new TherapyRelationsService(prisma, new BotClientOverviewService(prisma));

export const THERAPY_SCENARIOS: Scenario[] = [
  {
    name: 'former-therapist',
    title: 'Бывший терапевт клиента (GET /api/therapy/former-therapist)',
    // Уходит при каждом открытии профиля сайта у клиента без терапевта. У
    // бывшего клиента исполняется вся цепочка: живых связей нет, завершённые
    // выбираются по (clientId, status), терапевты подгружаются из User.
    run: async ({ prisma, formerClientId }) => {
      const info = await getFormerTherapistInfo(prisma, formerClientId);
      if (!info) {
        throw new Error('former-therapist: у клиента нет завершённых связей');
      }
      return info;
    },
  },
  {
    name: 'therapist-notes',
    title: 'Заметки сессий клиента (GET /api/therapy/notes/:clientId)',
    // Последние 100 заметок пары (date, createdAt, id по убыванию) и total.
    run: async ({ prisma, therapistId, heavyClientId }) => {
      const page = await new TherapyNotesService(
        prisma,
        relations(prisma),
      ).getNotes(therapistId, heavyClientId);
      if (page.total <= page.notes.length) {
        throw new Error('therapist-notes: заметок не больше одной страницы');
      }
      return page;
    },
  },
  {
    name: 'therapist-client-data',
    title:
      'Карточка клиента в кабинете (GET /api/therapy/client-data/:clientId)',
    // Профиль, YSQ с историей, колесо детства и признак ysqRequestPending —
    // count открытого задания ysq_test по UserTask(userId, done, type).
    run: async ({ prisma, therapistId, heavyClientId }) => {
      const card = await new TherapyClientDataService(
        prisma,
        new BotAnalyticsService(prisma),
        new NotificationService(prisma),
        relations(prisma),
      ).getClientData(therapistId, heavyClientId);
      if (!card.ysqRequestPending || card.ysqHistory.length === 0) {
        throw new Error(
          'therapist-client-data: нет открытого запроса YSQ или истории теста',
        );
      }
      return card;
    },
  },
  ...PATH_SCENARIOS,
];
