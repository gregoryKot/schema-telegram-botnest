// Аналитика админки на РЕАЛЬНОМ Postgres: группировка действий по дню МСК
// (сырой SQL) и groupBy-запросы сводки/терапевтов/людей — мок драйвера их не
// проверит (правило №18). Утверждения — по разнице до/после: база общая.
import { PrismaService } from '../src/prisma/prisma.service';
import { eventsPerDay } from '../src/analytics/admin/admin-events-daily';
import { AdminAnalyticsQueries } from '../src/analytics/admin/admin-analytics.queries';
import { AdminAnalyticsService } from '../src/analytics/admin/admin-analytics.service';
import { localDate } from '../src/utils/tz';

const THERAPIST = 999_000_700_001n;
const CLIENT = 999_000_700_002n;
const IDS = [THERAPIST, CLIENT];
const TZ = 'Europe/Moscow';

describe('аналитика админки на реальном Postgres', () => {
  let prisma: PrismaService;
  let svc: AdminAnalyticsService;

  const cleanup = async () => {
    await prisma.analyticsEvent.deleteMany({ where: { userId: { in: IDS } } });
    await prisma.therapistNote.deleteMany({
      where: { therapistId: THERAPIST },
    });
    await prisma.user.deleteMany({ where: { id: { in: IDS } } });
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    svc = new AdminAnalyticsService(new AdminAnalyticsQueries(prisma));
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('действия падают в день МСК, а не UTC: 21:30 UTC — уже завтра', async () => {
    const since = new Date(Date.now() - 3 * 86_400_000);
    const before = await eventsPerDay(prisma, since);
    // Полдень вчера по МСК и 23:30 МСК сегодня-вчера (21:30 UTC того же дня).
    const noon = new Date(Date.now() - 86_400_000);
    noon.setUTCHours(9, 0, 0, 0);
    const lateUtc = new Date(noon);
    lateUtc.setUTCHours(21, 30, 0, 0);
    await prisma.user.create({ data: { id: CLIENT } });
    await prisma.analyticsEvent.createMany({
      data: [
        { userId: CLIENT, name: 'share_card', createdAt: noon },
        { userId: CLIENT, name: 'share_card', createdAt: lateUtc },
      ],
    });
    const after = await eventsPerDay(prisma, since);
    const dayNoon = localDate(TZ, noon);
    const dayLate = localDate(TZ, lateUtc);
    expect(dayLate).not.toBe(dayNoon);
    const delta = (d: string) => (after.get(d) ?? 0) - (before.get(d) ?? 0);
    expect(delta(dayNoon)).toBe(1);
    expect(delta(dayLate)).toBe(1);
  });

  it('сводка, терапевты и люди собираются без ошибок драйвера', async () => {
    await prisma.user.create({
      data: { id: THERAPIST, role: 'THERAPIST', firstName: 'Тест' },
    });
    await prisma.therapistNote.create({
      data: {
        therapistId: THERAPIST,
        clientId: CLIENT,
        date: '2026-01-01',
        text: 'x',
      },
    });
    const overview = await svc.overview(7);
    expect(overview.daily).toHaveLength(7);
    expect(overview.features.some((f) => f.id === 'share')).toBe(true);

    const row = (await svc.therapists(7)).find(
      (t) => t.id === String(THERAPIST),
    );
    expect(row?.name).toBe('Тест');
    expect(row?.actions.notes).toBe(1);
    expect(row?.daily.reduce((a, b) => a + b, 0)).toBe(1);

    const people = await svc.people(7);
    expect(people.length).toBeLessThanOrEqual(50);
    expect(people.find((p) => p.id === String(CLIENT))?.top[0].title).toBe(
      'Поделиться карточкой',
    );
  });
});
