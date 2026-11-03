// «Сегодня клиента» в кабинете терапевта (QA 2026-10-26, правило №25).
//
// Оценки клиента лежат по ЕГО местным датам (notifyTimezone: POST /api/rating
// без даты кладёт localDate(tz)), а getClients считал «сегодня» и 14 дней
// истории днём UTC (`toISOString().slice(0, 10)`). В 00:10 по Москве
// (21:10 UTC) клиент, оценивший сегодня, выходил «без активности» с индексом
// «—», а оценивший вчера — «активность сегодня 5.0».
//
// Тест стоит на шве: TherapyRelationsService + настоящий
// BotClientOverviewService поверх фейковой Prisma — дни считаются той же
// цепочкой, что в проде.
import { TherapyRelationsService } from './therapy-relations.service';
import { BotClientOverviewService } from '../bot/bot.client-overview.service';

const T = 100n;
const MSK_TODAY = 1n; // Москва, оценил 27-го — у него сегодня
const MSK_YESTERDAY = 2n; // Москва, оценил 26-го — у него вчера
const LA_TODAY = 3n; // Лос-Анджелес, оценил 26-го — у него ещё сегодня

const NEEDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];
const fullDay = (userId: bigint, date: string, value: number) =>
  NEEDS.map((needId) => ({ userId, date, needId, value }));

const RATINGS = [
  ...fullDay(MSK_TODAY, '2026-10-27', 7),
  ...fullDay(MSK_YESTERDAY, '2026-10-26', 5),
  ...fullDay(LA_TODAY, '2026-10-26', 6),
];
const TZ: Record<string, string> = {
  [String(MSK_TODAY)]: 'Europe/Moscow',
  [String(MSK_YESTERDAY)]: 'Europe/Moscow',
  [String(LA_TODAY)]: 'America/Los_Angeles',
};

interface RatingWhere {
  userId: { in: bigint[] };
  date?: { in: string[] };
}

function makePrisma() {
  const clients = [MSK_TODAY, MSK_YESTERDAY, LA_TODAY];
  return {
    therapyRelation: {
      findMany: jest.fn(async () =>
        clients.map((id, i) => ({
          id: i + 1,
          therapistId: T,
          clientId: id,
          status: 'active',
          clientAlias: null,
          createdAt: new Date('2026-09-01T00:00:00Z'),
          therapyStartDate: null,
          nextSession: null,
          meetingDays: [],
          client: { id, firstName: `Клиент ${id}` },
        })),
      ),
    },
    clientConceptualization: { findMany: jest.fn(async () => []) },
    user: {
      findMany: jest.fn(
        async ({ where }: { where: { id: { in: bigint[] } } }) =>
          where.id.in.map((id) => ({ id, notifyTimezone: TZ[String(id)] })),
      ),
    },
    rating: {
      findMany: jest.fn(
        async ({
          where,
          distinct,
        }: {
          where: RatingWhere;
          distinct?: unknown;
        }) => {
          const rows = RATINGS.filter(
            (r) =>
              where.userId.in.includes(r.userId) &&
              (!where.date || where.date.in.includes(r.date)),
          );
          if (!distinct) return rows;
          const seen = new Set<string>();
          return rows.filter((r) => {
            const k = `${r.userId}|${r.date}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        },
      ),
    },
  };
}

describe('getClients — «сегодня» по календарю клиента', () => {
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    // 21:10 UTC 26-го = 00:10 27-го в Москве = 14:10 26-го в Лос-Анджелесе.
    jest.setSystemTime(new Date('2026-10-26T21:10:00Z'));
  });
  afterAll(() => jest.useRealTimers());

  async function clientsById() {
    const prisma = makePrisma();
    const service = new TherapyRelationsService(
      prisma as never,
      new BotClientOverviewService(prisma as never),
    );
    const list = await service.getClients(T);
    return new Map(list.map((c) => [c.telegramId, c]));
  }

  it('Москва, 00:10: оценка 27-го — сегодняшняя (индекс, lastActiveDate = его сегодня)', async () => {
    const c = (await clientsById()).get(MSK_TODAY)!;
    expect(c.todayIndex).toBe(7);
    expect(c.recentIndexHistory[0]).toBe(7);
    expect(c.lastActiveDate).toBe('2026-10-27');
    expect(c.daysSinceActive).toBe(0);
  });

  it('Москва, 00:10: оценка 26-го — вчерашняя, не «сегодня»', async () => {
    const c = (await clientsById()).get(MSK_YESTERDAY)!;
    expect(c.todayIndex).toBeNull();
    expect(c.recentIndexHistory[0]).toBeNull();
    expect(c.recentIndexHistory[1]).toBe(5);
    expect(c.lastActiveDate).toBe('2026-10-26');
    expect(c.daysSinceActive).toBe(1);
  });

  it('тот же момент, Лос-Анджелес: оценка 26-го — у клиента ещё сегодня', async () => {
    const c = (await clientsById()).get(LA_TODAY)!;
    expect(c.todayIndex).toBe(6);
    expect(c.lastActiveDate).toBe('2026-10-26');
    expect(c.daysSinceActive).toBe(0);
  });
});
