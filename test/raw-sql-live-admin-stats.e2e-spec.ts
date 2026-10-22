// Ядро отчёта /stats на РЕАЛЬНОМ Postgres с выборкой больше 5000 пар
// «человек–день» (аудит 2026-10, docs/AUDIT_2026-10_FINDINGS.md).
//
// Было: «Заходили за неделю», «Ведут дневник регулярно», «Могут уйти» и «Чаще
// всего заполняют» считались в памяти по `rating.findMany({ distinct, take:
// 5000 })`. Prisma дедуплицирует такую выборку в памяти поверх ORDER BY id,
// поэтому оставались 5000 САМЫХ СТАРЫХ пар, а свежие дни выпадали: при 300
// людях в день отчёт писал «Ведут дневник регулярно: 0 из 300». Юнит с моком
// этого не видит — обрезку делает драйвер Prisma, а не наш код (правило №18).
//
// Утверждения — по разнице до/после: база общая с соседними raw-sql-live-*
// спеками (один шаг джобы migrations), и чужие строки в ней законны.
import { PrismaService } from '../src/prisma/prisma.service';
import { BotAdminStatsService } from '../src/bot/bot.admin-stats.service';
import { localDate } from '../src/utils/tz';

const DAY = 86_400_000;
// Зона отчёта: Rating.date пишется в зоне пользователя, по умолчанию МСК
// (notifyTimezone @default в schema.prisma) — правило №25.
const TZ = 'Europe/Moscow';
const BASE = 999_000_600_000n;
const REGULAR = Array.from({ length: 300 }, (_, i) => BASE + BigInt(i));
// Был в окне месяца, но не на этой неделе → «могут уйти».
const CHURN_ID = BASE + 500n;
// Три дня старше недели и один на этой неделе → заходил, но не «ядро».
const OLD_DAYS_ID = BASE + 501n;
const ALL_IDS = [...REGULAR, CHURN_ID, OLD_DAYS_ID];
const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

interface CoreNumbers {
  today: number;
  week7: number;
  month30: number;
  core: number;
  churn: number;
  bestDow: string;
}

function num(text: string, re: RegExp): number {
  const m = text.match(re);
  if (!m) throw new Error(`в отчёте нет строки ${re}:\n${text}`);
  return Number(m[1]);
}

function parse(text: string): CoreNumbers {
  return {
    today: num(text, /Заполнили сегодня: (\d+)/),
    week7: num(text, /Заходили за неделю: (\d+)/),
    month30: num(text, /Заходили за неделю: \d+ · за месяц: (\d+)/),
    core: num(text, /Ведут дневник регулярно \([^)]*\): (\d+) из/),
    churn: num(text, /Могут уйти \([^)]*\): (\d+)/),
    bestDow: text.match(/Чаще всего заполняют: ([^\n]+)/)?.[1] ?? '',
  };
}

describe('/stats ядро на реальном Postgres: больше 5000 пар «человек–день»', () => {
  let prisma: PrismaService;
  let admin: BotAdminStatsService;
  const now = Date.now();
  const day = (ago: number) => localDate(TZ, new Date(now - ago * DAY));

  async function cleanup(): Promise<void> {
    // Rating уходит каскадом (onDelete: Cascade).
    await prisma.user.deleteMany({ where: { id: { in: ALL_IDS } } });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    admin = new BotAdminStatsService(prisma);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('свежие дни не теряются: «ядро» — все 300 ежедневных, «могут уйти» и день недели верны', async () => {
    const before = parse(await admin.getAdminStats());

    await prisma.user.createMany({ data: ALL_IDS.map((id) => ({ id })) });
    // Дни 0 и 3..30 (1 и 2 пропущены): день недели «сегодня» встречается пять
    // раз, все остальные — не больше четырёх, так что победитель однозначен.
    // Вставка от старых дат к новым: у свежих дней самые большие id — ровно
    // так растёт настоящая таблица.
    const regularDays = [...Array(31).keys()].filter((k) => k !== 1 && k !== 2);
    const rows: Array<{
      userId: bigint;
      date: string;
      needId: string;
      value: number;
    }> = [];
    for (const k of [...regularDays].reverse()) {
      for (const userId of REGULAR) {
        rows.push({ userId, date: day(k), needId: 'attachment', value: 5 });
      }
    }
    // Вторая потребность сегодня: одна пара «человек–день», а не две.
    for (const userId of REGULAR) {
      rows.push({ userId, date: day(0), needId: 'play', value: 6 });
    }
    for (const k of [12, 10]) {
      rows.push({ userId: CHURN_ID, date: day(k), needId: 'play', value: 4 });
    }
    for (const k of [10, 9, 8, 1]) {
      rows.push({
        userId: OLD_DAYS_ID,
        date: day(k),
        needId: 'play',
        value: 4,
      });
    }
    await prisma.rating.createMany({ data: rows });
    expect(REGULAR.length * regularDays.length).toBeGreaterThan(5000);

    const report = await admin.getAdminStats();
    const after = parse(report);
    expect(after.today - before.today).toBe(300);
    expect(after.week7 - before.week7).toBe(301); // 300 + OLD_DAYS_ID
    expect(after.month30 - before.month30).toBe(302); // + CHURN_ID
    expect(after.core - before.core).toBe(300);
    expect(after.churn - before.churn).toBe(1);
    expect(after.bestDow).toBe(
      DOW[new Date(day(0) + 'T12:00:00Z').getUTCDay()],
    );
    expect(report).toContain(`· ${day(0)}`);

    // Контрольный образец (правило №15 п.2): прежняя выборка на той же базе
    // теряет самый свежий день — значит, фикстура действительно за порогом и
    // тест умеет краснеть. Тем же счётом, что прежний countActiveCore, «ядро»
    // по обрезанной выборке не дотягивает до 300.
    const legacy = await prisma.rating.findMany({
      where: { date: { gte: day(30) } },
      select: { date: true, userId: true },
      distinct: ['userId', 'date'],
      take: 5000,
    });
    const mine = new Set(REGULAR.map(String));
    expect(
      legacy.some((r) => mine.has(String(r.userId)) && r.date === day(0)),
    ).toBe(false);
    const daysByUser = new Map<string, Set<string>>();
    for (const r of legacy) {
      if (!mine.has(String(r.userId)) || r.date < day(7)) continue;
      const set = daysByUser.get(String(r.userId)) ?? new Set<string>();
      set.add(r.date);
      daysByUser.set(String(r.userId), set);
    }
    const legacyCore = [...daysByUser.values()].filter((s) => s.size >= 3);
    expect(legacyCore.length).toBeLessThan(300);
  });

  it('повторный прогон на той же базе — идемпотентен (фикстуры вычищены)', async () => {
    await cleanup();
    expect(
      await prisma.rating.count({ where: { userId: { in: ALL_IDS } } }),
    ).toBe(0);
  });
});
