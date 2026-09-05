// Leader-election кронов на РЕАЛЬНОМ Postgres. Юнит-тест с моком тут ничего
// не доказывает: вся защита держится на атомарности одного запроса
// (`INSERT … ON CONFLICT DO UPDATE … WHERE runAt <= окно`), а атомарность —
// свойство СУБД, а не нашего кода. Фейк ответит что угодно.
//
// Проверяем то самое, ради чего механизм заведён: из двух одновременных
// инстансов прогон забирает ровно ОДИН. Гоняется в CI-джобе `migrations`,
// где поднят Postgres 16 и применены миграции.
import { PrismaService } from '../src/prisma/prisma.service';
import {
  CronLeaderService,
  LEASE_WINDOW,
} from '../src/infra/cron-leader.service';

describe('CronLeaderService на реальном Postgres', () => {
  let prisma: PrismaService;
  let leader: CronLeaderService;
  const name = 'e2eProbeCron';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    leader = new CronLeaderService(prisma);
  });

  beforeEach(async () => {
    await prisma.cronLease.deleteMany({ where: { name } });
  });

  afterAll(async () => {
    await prisma.cronLease.deleteMany({ where: { name } });
    await prisma.$disconnect();
  });

  it('первый в жизни прогон забирается, строка аренды появляется', async () => {
    const now = new Date();

    await expect(leader.claimRun(name, LEASE_WINDOW.hourly, now)).resolves.toBe(
      true,
    );

    const row = await prisma.cronLease.findUnique({ where: { name } });
    expect(row?.runAt.getTime()).toBe(now.getTime());
    expect(row?.instanceId).toEqual(expect.any(String));
  });

  it('повторный тик в том же окне не забирается и НЕ сдвигает аренду', async () => {
    const first = new Date();
    await leader.claimRun(name, LEASE_WINDOW.hourly, first);

    const soon = new Date(first.getTime() + 60_000);
    await expect(
      leader.claimRun(name, LEASE_WINDOW.hourly, soon),
    ).resolves.toBe(false);

    // Отказ обязан быть без побочного эффекта: если бы UPDATE прошёл, окно
    // ползло бы вперёд на каждом отказе и следующий законный тик не наступил бы.
    const row = await prisma.cronLease.findUnique({ where: { name } });
    expect(row?.runAt.getTime()).toBe(first.getTime());
  });

  it('окно истекло — прогон снова забирается, аренда сдвигается', async () => {
    const first = new Date();
    await leader.claimRun(name, LEASE_WINDOW.hourly, first);

    const later = new Date(first.getTime() + LEASE_WINDOW.hourly + 1000);
    await expect(
      leader.claimRun(name, LEASE_WINDOW.hourly, later),
    ).resolves.toBe(true);

    const row = await prisma.cronLease.findUnique({ where: { name } });
    expect(row?.runAt.getTime()).toBe(later.getTime());
  });

  it('два одновременных инстанса — прогон забирает ровно один', async () => {
    const now = new Date();

    // Оба запроса уходят параллельно и попадают на разные соединения пула —
    // это и есть модель двух подов с одинаковым расписанием.
    const results = await Promise.all([
      leader.claimRun(name, LEASE_WINDOW.hourly, now),
      leader.claimRun(name, LEASE_WINDOW.hourly, now),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('десять одновременных инстансов — по-прежнему ровно один', async () => {
    const now = new Date();

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        leader.claimRun(name, LEASE_WINDOW.hourly, now),
      ),
    );

    // Контрольная проверка того же с запасом: если бы захват был
    // check-then-act, при десяти параллельных победителей было бы несколько.
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
