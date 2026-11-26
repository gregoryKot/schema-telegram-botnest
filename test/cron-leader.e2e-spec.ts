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
import {
  alertLeaseName,
  alertLeaseStore,
} from '../src/infra/self-check/alert-dedup';
import { REMIND_EVERY_MS } from '../src/infra/self-check/alert-tracker';
import { syncProcessLives } from '../src/infra/self-check/process-lives';

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

// Дедуп DM самопроверки (src/infra/self-check/alert-dedup.ts, инцидент
// 2026-11-07): та же аренда под именем набора упавших проб. На живой базе —
// имя с двоеточием и запятыми, захват без глотания ошибки и чистка по префиксу,
// которая не трогает аренды кронов.
describe('Аренда алерта самопроверки на реальном Postgres', () => {
  let prisma: PrismaService;
  let leader: CronLeaderService;
  const cronName = 'e2eAlertNeighbourCron';
  const alertName = alertLeaseName([
    { id: 'telegram', title: 't', ok: false, detail: '', reportInHealth: true },
    {
      id: 'googleOAuth',
      title: 'g',
      ok: false,
      detail: '',
      reportInHealth: true,
    },
  ]);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    leader = new CronLeaderService(prisma);
  });

  beforeEach(async () => {
    await prisma.cronLease.deleteMany({
      where: { name: { in: [cronName, alertName] } },
    });
  });

  afterAll(async () => {
    await prisma.cronLease.deleteMany({
      where: { name: { in: [cronName, alertName] } },
    });
    await prisma.$disconnect();
  });

  it('рестарт с тем же набором в окне 6 ч — второй захват не удаётся', async () => {
    const store = alertLeaseStore(leader, prisma);
    await expect(store.claim(alertName, REMIND_EVERY_MS)).resolves.toBe(true);
    // Новый процесс — новый экземпляр, база та же.
    const next = alertLeaseStore(new CronLeaderService(prisma), prisma);
    await expect(next.claim(alertName, REMIND_EVERY_MS)).resolves.toBe(false);
    const row = await prisma.cronLease.findUnique({
      where: { name: alertName },
    });
    expect(row?.name).toBe('self-check-alert:googleOAuth,telegram');
  });

  it('зелёный прогон удаляет строки алертов и не трогает аренду крона', async () => {
    await leader.claimRun(cronName, LEASE_WINDOW.hourly);
    const store = alertLeaseStore(leader, prisma);
    await store.claim(alertName, REMIND_EVERY_MS);

    await expect(store.clearAll()).resolves.toBeGreaterThanOrEqual(1);

    await expect(
      prisma.cronLease.findUnique({ where: { name: alertName } }),
    ).resolves.toBeNull();
    await expect(
      prisma.cronLease.findUnique({ where: { name: cronName } }),
    ).resolves.not.toBeNull();
    // Строк нет — следующий такой же сбой алертит сразу.
    await expect(store.claim(alertName, REMIND_EVERY_MS)).resolves.toBe(true);
  });
});

// Жизни процессов для пробы cronLeases (process-lives.ts, аудит 2026-10:
// суточный крон при частых деплоях ловился на 4-е сутки). Прошлый процесс
// отметился — следующий прочитал его отрезок через настоящий драйвер.
describe('жизни процессов на реальном Postgres', () => {
  let prisma: PrismaService;
  const ids = ['e2e-life-a', 'e2e-life-b'];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.processLife.deleteMany({
      where: { OR: ids.map((id) => ({ id: { startsWith: `${id}@` } })) },
    });
    await prisma.$disconnect();
  });

  it('прошлый процесс записал отрезок — следующий его прочитал', async () => {
    const now = Date.now();
    await syncProcessLives(
      prisma,
      { startedAt: now - 7_200_000, now: now - 600_000, failures: [] },
      ids[0],
    );
    const earlier = await syncProcessLives(
      prisma,
      { startedAt: now - 60_000, now, failures: [now - 30_000] },
      ids[1],
    );
    expect(earlier).toContainEqual({
      from: now - 7_200_000,
      to: now - 600_000,
    });
  });
});
