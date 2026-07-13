import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NeedId, NEED_IDS } from './bot.service';
import { localDate } from '../utils/tz';

export interface RetentionPoint {
  cohort: number;
  retained: number;
}
export interface RetentionStats {
  d1: RetentionPoint;
  d7: RetentionPoint;
  d30: RetentionPoint;
  funnel: { registered30: number; consented30: number; filledOnce30: number };
}

/** Блок для /stats — чистая функция, покрыта тестом. */
export function formatRetentionBlock(s: RetentionStats): string {
  const pct = (p: RetentionPoint) =>
    p.cohort === 0
      ? '—'
      : `${Math.round((p.retained / p.cohort) * 100)}% (${p.retained}/${p.cohort})`;
  const f = s.funnel;
  const fp = (n: number) =>
    f.registered30 === 0 ? '' : ` (${Math.round((n / f.registered30) * 100)}%)`;
  return [
    `📉 <b>Когортный retention</b> (недельные когорты)`,
    `D1: ${pct(s.d1)} · D7: ${pct(s.d7)} · D30: ${pct(s.d30)}`,
    '',
    `🚪 <b>Воронка онбординга</b> (регистрации за 30д)`,
    `Регистрация: ${f.registered30}`,
    `→ Приняли согласие: ${f.consented30}${fp(f.consented30)}`,
    `→ Заполнили трекер хоть раз: ${f.filledOnce30}${fp(f.filledOnce30)}`,
  ].join('\n');
}

@Injectable()
export class BotAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private localDateString(tz: string, base = new Date()): string {
    return localDate(tz, base);
  }

  private async userTimezone(userId: bigint): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifyTimezone: true },
    });
    return user?.notifyTimezone ?? 'Europe/Moscow';
  }

  /**
   * Батчевый обзор клиентов для кабинета терапевта (аудит 2026-07, N+1).
   * Раньше getClients делал ~6 SQL на каждого клиента (стрик, давность,
   * история — каждый с отдельным чтением таймзоны): 50 клиентов ≈ 300
   * запросов. Теперь 3 запроса на весь список. Семантика полей идентична
   * getConsecutiveDays / getDaysSinceLastFill / getHistoryRatings(14).
   */
  async getClientOverviews(userIds: bigint[]): Promise<
    Map<
      string,
      {
        streak: number;
        daysSince: number;
        history: Array<{
          date: string;
          ratings: Partial<Record<NeedId, number>>;
        }>;
      }
    >
  > {
    const out = new Map<
      string,
      {
        streak: number;
        daysSince: number;
        history: Array<{
          date: string;
          ratings: Partial<Record<NeedId, number>>;
        }>;
      }
    >();
    if (userIds.length === 0) return out;

    // 1) Таймзоны всех клиентов одним запросом.
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, notifyTimezone: true },
    });
    const tzById = new Map(
      users.map((u) => [String(u.id), u.notifyTimezone ?? 'Europe/Moscow']),
    );

    // 2) Все (userId, date) — для стрика и давности последнего заполнения.
    const allDates = await this.prisma.rating.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, date: true },
      distinct: ['userId', 'date'],
    });
    const datesByUser = new Map<string, Set<string>>();
    for (const r of allDates) {
      const key = String(r.userId);
      if (!datesByUser.has(key)) datesByUser.set(key, new Set());
      datesByUser.get(key)!.add(r.date);
    }

    // 3) Оценки за последние 14 локальных дней (объединение дат по всем TZ).
    const recentDatesByUser = new Map<string, string[]>();
    const union = new Set<string>();
    for (const id of userIds) {
      const tz = tzById.get(String(id)) ?? 'Europe/Moscow';
      const dates = Array.from({ length: 14 }, (_, i) =>
        this.localDateString(tz, new Date(Date.now() - i * 86_400_000)),
      );
      recentDatesByUser.set(String(id), dates);
      for (const d of dates) union.add(d);
    }
    const recentRows = await this.prisma.rating.findMany({
      where: { userId: { in: userIds }, date: { in: [...union] } },
    });
    const ratingsByUserDate = new Map<
      string,
      Partial<Record<NeedId, number>>
    >();
    for (const row of recentRows) {
      const key = `${row.userId}|${row.date}`;
      if (!ratingsByUserDate.has(key)) ratingsByUserDate.set(key, {});
      ratingsByUserDate.get(key)![row.needId as NeedId] = row.value;
    }

    for (const id of userIds) {
      const key = String(id);
      const tz = tzById.get(key) ?? 'Europe/Moscow';
      const dates = datesByUser.get(key) ?? new Set<string>();

      let streak = 0;
      while (
        dates.has(
          this.localDateString(tz, new Date(Date.now() - streak * 86_400_000)),
        )
      ) {
        streak++;
      }

      let daysSince = -1;
      if (dates.size > 0) {
        const maxDate = [...dates].sort().at(-1)!;
        const today = this.localDateString(tz);
        daysSince = Math.floor(
          (Date.parse(today + 'T00:00:00Z') -
            Date.parse(maxDate + 'T00:00:00Z')) /
            86_400_000,
        );
      }

      const recent = recentDatesByUser.get(key)!;
      const history = recent
        .filter((d) => ratingsByUserDate.has(`${key}|${d}`))
        .map((d) => ({
          date: d,
          ratings: ratingsByUserDate.get(`${key}|${d}`)!,
        }));

      out.set(key, { streak, daysSince, history });
    }
    return out;
  }

  async getHistoryRatings(
    userId: bigint,
    days: number,
  ): Promise<
    Array<{ date: string; ratings: Partial<Record<NeedId, number>> }>
  > {
    const tz = await this.userTimezone(userId);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.localDateString(tz, d);
    });
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: { in: dates } },
    });
    const byDate = new Map<string, Partial<Record<NeedId, number>>>();
    for (const row of rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      byDate.get(row.date)![row.needId as NeedId] = row.value;
    }
    return dates
      .filter((d) => byDate.has(d))
      .map((d) => ({ date: d, ratings: byDate.get(d)! }));
  }

  async getLowStreakNeeds(
    userId: bigint,
    threshold: number,
    days: number,
  ): Promise<NeedId[]> {
    const tz = await this.userTimezone(userId);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.localDateString(tz, d);
    });
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: { in: dates } },
    });
    return NEED_IDS.filter((needId) => {
      const needRows = rows.filter((r) => r.needId === needId);
      return (
        needRows.length === days && needRows.every((r) => r.value < threshold)
      );
    });
  }

  async getConsecutiveDays(userId: bigint): Promise<number> {
    const tz = await this.userTimezone(userId);
    const rows = await this.prisma.rating.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
    });
    const dates = new Set(rows.map((r) => r.date));
    let count = 0;
    while (true) {
      const dateStr = this.localDateString(
        tz,
        new Date(Date.now() - count * 86_400_000),
      );
      if (!dates.has(dateStr)) break;
      count++;
    }
    return count;
  }

  async getTotalDaysFilled(userId: bigint): Promise<number> {
    const rows = await this.prisma.rating.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
    });
    return rows.length;
  }

  async getDaysSinceLastFill(userId: bigint): Promise<number> {
    const last = await this.prisma.rating.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!last) return -1;
    const tz = await this.userTimezone(userId);
    const today = this.localDateString(tz);
    const diffMs =
      new Date(today + 'T00:00:00Z').getTime() -
      new Date(last.date + 'T00:00:00Z').getTime();
    return Math.floor(diffMs / 86_400_000);
  }

  /** Сколько разных дней с записями за последние N локальных дней (включая сегодня) */
  async getFillDaysInLast(userId: bigint, days: number): Promise<number> {
    const tz = await this.userTimezone(userId);
    const dates = Array.from({ length: days }, (_, i) =>
      this.localDateString(tz, new Date(Date.now() - i * 86_400_000)),
    );
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true },
      distinct: ['date'],
    });
    return rows.length;
  }

  /**
   * Перерыв (в днях) перед самой свежей записью: разница между двумя последними
   * различными датами записей. null если записей меньше двух.
   * Используется для comeback: свежая запись сегодня после перерыва ≥3 дней.
   */
  async getGapBeforeLatestFill(userId: bigint): Promise<number | null> {
    const rows = await this.prisma.rating.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'desc' },
      take: 2,
    });
    if (rows.length < 2) return null;
    const diffMs =
      new Date(rows[0].date + 'T00:00:00Z').getTime() -
      new Date(rows[1].date + 'T00:00:00Z').getTime();
    return Math.floor(diffMs / 86_400_000);
  }

  async getWeeklyStats(
    userId: bigint,
  ): Promise<
    Array<{ needId: NeedId; avg: number | null; trend: '↑' | '↓' | '→' }>
  > {
    const tz = await this.userTimezone(userId);
    const last14 = Array.from({ length: 14 }, (_, i) =>
      this.localDateString(tz, new Date(Date.now() - i * 86_400_000)),
    );
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: { in: last14 } },
    });
    const curSet = new Set(last14.slice(0, 7));
    const prevSet = new Set(last14.slice(7));

    return NEED_IDS.map((needId) => {
      const cur = rows.filter((r) => r.needId === needId && curSet.has(r.date));
      const prev = rows.filter(
        (r) => r.needId === needId && prevSet.has(r.date),
      );
      const avg = cur.length
        ? cur.reduce((s, r) => s + r.value, 0) / cur.length
        : null;
      const prevAvg = prev.length
        ? prev.reduce((s, r) => s + r.value, 0) / prev.length
        : null;
      const trend: '↑' | '↓' | '→' =
        avg !== null && prevAvg !== null && avg - prevAvg > 0.5
          ? '↑'
          : avg !== null && prevAvg !== null && avg - prevAvg < -0.5
            ? '↓'
            : '→';
      return { needId, avg, trend };
    });
  }

  /**
   * Сводный «портрет» по всей истории: сколько дней всего, сильнейшая и слабейшая
   * потребности (all-time средние). Питает value-based возвраты (comeback / value_recap):
   * возвращаем не «я есть», а зеркало собственных данных юзера.
   * null, если данных мало (<5 дней) — новичку такой инсайт был бы шумом.
   */
  async getProfileInsight(userId: bigint): Promise<{
    totalDays: number;
    strongest: NeedId;
    strongestAvg: number;
    weakest: NeedId;
    weakestAvg: number;
  } | null> {
    const rows = await this.prisma.rating.findMany({
      where: { userId },
      select: { date: true, needId: true, value: true },
    });
    if (rows.length === 0) return null;
    const totalDays = new Set(rows.map((r) => r.date)).size;
    if (totalDays < 5) return null;

    const byNeed = new Map<NeedId, { sum: number; n: number }>();
    for (const r of rows) {
      const cur = byNeed.get(r.needId as NeedId) ?? { sum: 0, n: 0 };
      cur.sum += r.value;
      cur.n++;
      byNeed.set(r.needId as NeedId, cur);
    }
    const avgs = [...byNeed.entries()]
      .filter(([, v]) => v.n >= 3) // потребность отмечалась хотя бы 3 раза — иначе среднее не значимо
      .map(([needId, v]) => ({ needId, avg: v.sum / v.n }));
    if (avgs.length === 0) return null;
    avgs.sort((a, b) => b.avg - a.avg);
    const strongest = avgs[0];
    const weakest = avgs[avgs.length - 1];
    return {
      totalDays,
      strongest: strongest.needId,
      strongestAvg: strongest.avg,
      weakest: weakest.needId,
      weakestAvg: weakest.avg,
    };
  }

  async getAchievements(
    userId: bigint,
  ): Promise<Array<{ id: string; earned: boolean }>> {
    const streak = await this.getStreakData(userId);
    const total = streak.totalDays;
    const longest = streak.longestStreak;

    // Check for high index day or all-needs day
    const rows = await this.prisma.rating.findMany({
      where: { userId },
      select: { date: true, needId: true, value: true },
    });
    const byDate = new Map<string, Record<string, number>>();
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date, {});
      byDate.get(r.date)![r.needId] = r.value;
    }
    let hasHighDay = false,
      hasAllAbove7 = false,
      hasGrowth = false,
      hasComeBack = false;
    for (const [, ratings] of byDate) {
      const vals = Object.values(ratings);
      if (vals.length === 5) {
        const avg = vals.reduce((s, v) => s + v, 0) / 5;
        if (avg >= 8) hasHighDay = true;
        if (vals.every((v) => v >= 7)) hasAllAbove7 = true;
      }
    }
    // comeback: sorted dates, find gap >= 3 then resumption
    const sorted = [...byDate.keys()].sort();
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + 'T12:00:00Z');
      const cur = new Date(sorted[i] + 'T12:00:00Z');
      if (Math.round((cur.getTime() - prev.getTime()) / 86_400_000) >= 3) {
        hasComeBack = true;
        break;
      }
    }
    // growth: compare last 7 days vs prev 7 days per need
    const tz = await this.userTimezone(userId);
    const last14 = Array.from({ length: 14 }, (_, i) =>
      this.localDateString(tz, new Date(Date.now() - i * 86_400_000)),
    );
    const recent = rows.filter((r) => last14.slice(0, 7).includes(r.date));
    const older = rows.filter((r) => last14.slice(7).includes(r.date));
    for (const needId of NEED_IDS) {
      const r = recent.filter((r) => r.needId === needId);
      const o = older.filter((r) => r.needId === needId);
      if (r.length && o.length) {
        const rAvg = r.reduce((s, x) => s + x.value, 0) / r.length;
        const oAvg = o.reduce((s, x) => s + x.value, 0) / o.length;
        if (rAvg - oAvg >= 3) {
          hasGrowth = true;
          break;
        }
      }
    }

    return [
      { id: 'first_day', earned: total >= 1 },
      { id: 'streak_3', earned: longest >= 3 },
      { id: 'streak_7', earned: longest >= 7 },
      { id: 'streak_14', earned: longest >= 14 },
      { id: 'streak_30', earned: longest >= 30 },
      { id: 'streak_100', earned: longest >= 100 },
      { id: 'total_10', earned: total >= 10 },
      { id: 'total_50', earned: total >= 50 },
      { id: 'high_day', earned: hasHighDay },
      { id: 'all_above7', earned: hasAllAbove7 },
      { id: 'comeback', earned: hasComeBack },
      { id: 'growth', earned: hasGrowth },
    ];
  }

  /** Collect all active dates from any source: ratings, diaries, or explicit app activity. */
  private async getActiveDates(userId: bigint): Promise<Set<string>> {
    const uid = userId;
    const [ratings, activity, schema, mode, gratitude] = await Promise.all([
      this.prisma.rating.findMany({
        where: { userId: uid },
        select: { date: true },
        distinct: ['date'],
      }),
      this.prisma.appActivity.findMany({
        where: { userId: uid },
        select: { date: true },
      }),
      this.prisma.schemaDiaryEntry.findMany({
        where: { userId: uid },
        select: { createdAt: true },
      }),
      this.prisma.modeDiaryEntry.findMany({
        where: { userId: uid },
        select: { createdAt: true },
      }),
      this.prisma.gratitudeDiaryEntry.findMany({
        where: { userId: uid },
        select: { date: true },
      }),
    ]);
    const tz = await this.userTimezone(userId);
    const set = new Set<string>();
    for (const r of ratings) set.add(r.date);
    for (const a of activity) set.add(a.date);
    for (const e of schema) set.add(this.localDateString(tz, e.createdAt));
    for (const e of mode) set.add(this.localDateString(tz, e.createdAt));
    for (const e of gratitude) set.add(e.date);
    return set;
  }

  async recordActivity(userId: bigint): Promise<{ ok: boolean }> {
    const tz = await this.userTimezone(userId);
    const date = this.localDateString(tz);
    await this.prisma.appActivity.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date },
      update: {},
    });
    return { ok: true };
  }

  async getStreakData(userId: bigint): Promise<{
    currentStreak: number;
    longestStreak: number;
    totalDays: number;
    todayDone: boolean;
    weekDots: boolean[];
  }> {
    const tz = await this.userTimezone(userId);
    const dates = await this.getActiveDates(userId);
    const today = this.localDateString(tz);

    // current streak — if today not yet filled, count from yesterday
    const startOffset = dates.has(today) ? 0 : 1;
    let currentStreak = 0;
    while (true) {
      const d = this.localDateString(
        tz,
        new Date(Date.now() - (startOffset + currentStreak) * 86_400_000),
      );
      if (!dates.has(d)) break;
      currentStreak++;
    }

    // longest streak — scan sorted distinct dates
    const sorted = [...dates].sort();
    let longest = 0,
      run = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        run = 1;
        continue;
      }
      const prev = new Date(sorted[i - 1] + 'T12:00:00Z');
      const cur = new Date(sorted[i] + 'T12:00:00Z');
      const diffDays = Math.round(
        (cur.getTime() - prev.getTime()) / 86_400_000,
      );
      run = diffDays === 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }
    // cover single-date case: loop never updates longest when sorted.length === 1
    if (run > longest) longest = run;
    if (currentStreak > longest) longest = currentStreak;

    // week dots — current calendar week Mon–Sun (future days = false)
    const [ty, tm, td] = today.split('-').map(Number);
    const todayUtcNoon = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));
    const todayDow = (todayUtcNoon.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
    const weekDots = Array.from({ length: 7 }, (_, i) => {
      if (i > todayDow) return false; // future day
      const dayDate = new Date(
        todayUtcNoon.getTime() + (i - todayDow) * 86_400_000,
      );
      return dates.has(this.localDateString(tz, dayDate));
    });

    return {
      currentStreak,
      longestStreak: longest,
      totalDays: dates.size,
      todayDone: dates.has(today),
      weekDots,
    };
  }

  async getBestDayOfWeek(userId: bigint): Promise<string | null> {
    const rows = await this.prisma.rating.findMany({ where: { userId } });
    if (rows.length === 0) return null;
    const sumByDow = new Map<number, { sum: number; count: number }>();
    const DAY_NAMES = [
      'воскресенье',
      'понедельник',
      'вторник',
      'среда',
      'четверг',
      'пятница',
      'суббота',
    ];
    const sumByDate = new Map<string, number>();
    for (const r of rows)
      sumByDate.set(r.date, (sumByDate.get(r.date) ?? 0) + r.value);
    for (const [date, sum] of sumByDate) {
      const dow = new Date(date + 'T12:00:00Z').getUTCDay();
      const cur = sumByDow.get(dow) ?? { sum: 0, count: 0 };
      sumByDow.set(dow, { sum: cur.sum + sum, count: cur.count + 1 });
    }
    if (sumByDow.size < 3) return null;
    const bestDow = [...sumByDow.entries()]
      .map(([dow, { sum, count }]) => ({ dow, avg: sum / count }))
      .reduce((a, b) => (b.avg > a.avg ? b : a)).dow;
    return DAY_NAMES[bestDow];
  }

  /**
   * Когортный retention + воронка онбординга (аудит 2026-07, этап 4.6 /
   * правило №8 CLAUDE.md: гипотезы про онбординг проверяются D1/D7/D30,
   * а не ощущениями). Всё выводится из существующих данных — User.createdAt,
   * AppActivity, Rating, disclaimerAccepted; событийной таблицы не требуется.
   */
  async getRetentionStats(): Promise<RetentionStats> {
    // DN: юзеры, зарегистрированные [N, N+7) дней назад (когорта недели);
    // retained = есть AppActivity ровно в день createdAt + N дней.
    // AppActivity.date — локальная дата юзера, createdAt — UTC: для
    // админ-метрики допустимо (±1 день на границах таймзон).
    const point = async (n: number): Promise<RetentionPoint> => {
      const rows = await this.prisma.$queryRaw<
        Array<{ cohort: bigint; retained: bigint }>
      >`
        SELECT count(*)::bigint AS cohort,
               count(*) FILTER (
                 WHERE EXISTS (
                   SELECT 1 FROM "AppActivity" a
                   WHERE a."userId" = u.id
                     AND a."date" = to_char((u."createdAt" + make_interval(days => ${n}))::date, 'YYYY-MM-DD')
                 )
               )::bigint AS retained
        FROM "User" u
        WHERE u."createdAt" >= now() - make_interval(days => ${n + 7})
          AND u."createdAt" <  now() - make_interval(days => ${n})
      `;
      return {
        cohort: Number(rows[0]?.cohort ?? 0),
        retained: Number(rows[0]?.retained ?? 0),
      };
    };
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [d1, d7, d30, registered30, consented30, filledRows] =
      await Promise.all([
        point(1),
        point(7),
        point(30),
        this.prisma.user.count({ where: { createdAt: { gte: since30 } } }),
        this.prisma.user.count({
          where: { createdAt: { gte: since30 }, disclaimerAccepted: true },
        }),
        this.prisma.$queryRaw<Array<{ c: bigint }>>`
          SELECT count(*)::bigint AS c FROM "User" u
          WHERE u."createdAt" >= ${since30}
            AND EXISTS (SELECT 1 FROM "Rating" r WHERE r."userId" = u.id)
        `,
      ]);
    return {
      d1,
      d7,
      d30,
      funnel: {
        registered30,
        consented30,
        filledOnce30: Number(filledRows[0]?.c ?? 0),
      },
    };
  }

  async getAdminStats(): Promise<string> {
    const now = new Date();
    const today = this.localDateString('UTC', now);
    const d7 = this.localDateString(
      'UTC',
      new Date(now.getTime() - 7 * 86_400_000),
    );
    const d30 = this.localDateString(
      'UTC',
      new Date(now.getTime() - 30 * 86_400_000),
    );
    const ago7 = new Date(now.getTime() - 7 * 86_400_000);
    const ago30 = new Date(now.getTime() - 30 * 86_400_000);

    const [
      totalUsers,
      newUsers7,
      newUsers30,
      notifyOff,
      blockedUsers,
      activePairs,
      todayRatings,
      week7Ratings,
      month30Ratings,
      needAvgs,
      fillsByDow,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: ago7 } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: ago30 } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, notifyEnabled: false },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, botBlockedAt: { not: null } },
      }),
      this.prisma.pair.count({ where: { status: 'active' } }),
      this.prisma.rating.findMany({
        where: { date: today },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.rating.findMany({
        where: { date: { gte: d7 } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.rating.findMany({
        where: { date: { gte: d30 } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Average score per need over last 7 days
      this.prisma.rating.groupBy({
        by: ['needId'],
        where: { date: { gte: d7 } },
        _avg: { value: true },
        orderBy: { _avg: { value: 'asc' } },
      }),
      // Fills by day of week (last 30 days) — date strings, compute DOW in JS
      this.prisma.rating.findMany({
        where: { date: { gte: d30 } },
        select: { date: true, userId: true },
        distinct: ['userId', 'date'],
      }),
    ]);

    // Retention funnel — count users with N+ distinct fill days (raw SQL for efficiency)
    const retentionRows = (await this.prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt FROM (
        SELECT "userId" FROM "Rating" GROUP BY "userId" HAVING COUNT(DISTINCT date) >= 1
      ) t`) as any[];
    const ret1 = Number(retentionRows[0]?.cnt ?? 0);
    const ret3 = Number(
      (
        await this.prisma.$queryRaw<any[]>`
      SELECT COUNT(*) AS cnt FROM (SELECT "userId" FROM "Rating" GROUP BY "userId" HAVING COUNT(DISTINCT date) >= 3) t`
      )[0]?.cnt ?? 0,
    );
    const ret7 = Number(
      (
        await this.prisma.$queryRaw<any[]>`
      SELECT COUNT(*) AS cnt FROM (SELECT "userId" FROM "Rating" GROUP BY "userId" HAVING COUNT(DISTINCT date) >= 7) t`
      )[0]?.cnt ?? 0,
    );
    const ret30 = Number(
      (
        await this.prisma.$queryRaw<any[]>`
      SELECT COUNT(*) AS cnt FROM (SELECT "userId" FROM "Rating" GROUP BY "userId" HAVING COUNT(DISTINCT date) >= 30) t`
      )[0]?.cnt ?? 0,
    );

    // Churn signal: active in d7-d30 but NOT in last 7 days
    const activeRecent = new Set(week7Ratings.map((r) => String(r.userId)));
    const activeOlder = new Set(
      await this.prisma.rating
        .findMany({
          where: { date: { gte: d30, lt: d7 } },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((rows) => rows.map((r) => String(r.userId))),
    );
    const churnRisk = [...activeOlder].filter(
      (id) => !activeRecent.has(id),
    ).length;

    // Most neglected need (lowest avg this week)
    const lowestNeed = needAvgs[0];
    const needLabels: Record<string, string> = {
      attachment: 'Привязанность',
      autonomy: 'Автономия',
      expression: 'Выражение чувств',
      play: 'Спонтанность',
      limits: 'Границы',
    };

    // Best fill day of week (last 30 days) — count user-day pairs per DOW
    const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const dowCounts = new Array(7).fill(0);
    for (const r of fillsByDow) {
      dowCounts[new Date(r.date + 'T12:00:00Z').getUTCDay()]++;
    }
    const bestDow = dowCounts.indexOf(Math.max(...dowCounts));
    const fillRate =
      month30Ratings.length > 0
        ? Math.round((todayRatings.length / month30Ratings.length) * 100)
        : 0;

    const lines = [
      `📊 <b>Статистика бота</b> · ${today}`,
      '',
      `👥 <b>Пользователи</b>`,
      `Всего: ${totalUsers} (новых за 7д: ${newUsers7}, за 30д: ${newUsers30})`,
      `Отключили уведомления: ${notifyOff} · заблокировали: ${blockedUsers}`,
      '',
      `📔 <b>Дневник</b>`,
      `Сегодня: ${todayRatings.length} (${fillRate}% от MAU)`,
      `Активных за 7д: ${week7Ratings.length} · за 30д: ${month30Ratings.length}`,
      `⚠️ Риск оттока (были 8-30д, нет 7д): ${churnRisk}`,
      '',
      `📈 <b>Retention (все время)</b>`,
      `1+ день: ${ret1}  ·  3+ дня: ${ret3}  ·  7+ дней: ${ret7}  ·  30+ дней: ${ret30}`,
      '',
      `🔍 <b>Инсайты за 7 дней</b>`,
      lowestNeed
        ? `Западает: ${needLabels[lowestNeed.needId] ?? lowestNeed.needId} (avg ${lowestNeed._avg.value?.toFixed(1)})`
        : 'Нет данных по потребностям',
      `Лучший день для заполнения: ${DOW[bestDow]}`,
      '',
      `💑 <b>Пары</b>`,
      `Активных пар: ${activePairs}`,
    ];

    const retention = await this.getRetentionStats();
    return lines.join('\n') + '\n\n' + formatRetentionBlock(retention);
  }

  async getWorstDayOfWeek(userId: bigint): Promise<string | null> {
    const rows = await this.prisma.rating.findMany({ where: { userId } });
    if (rows.length === 0) return null;
    const sumByDow = new Map<number, { sum: number; count: number }>();
    const DAY_NAMES = [
      'воскресенье',
      'понедельник',
      'вторник',
      'среда',
      'четверг',
      'пятница',
      'суббота',
    ];
    // Group by day of week using all historical data
    const sumByDate = new Map<string, number>();
    for (const r of rows)
      sumByDate.set(r.date, (sumByDate.get(r.date) ?? 0) + r.value);
    for (const [date, sum] of sumByDate) {
      const dow = new Date(date + 'T12:00:00Z').getUTCDay();
      const cur = sumByDow.get(dow) ?? { sum: 0, count: 0 };
      sumByDow.set(dow, { sum: cur.sum + sum, count: cur.count + 1 });
    }
    if (sumByDow.size < 3) return null; // need at least 3 different days of week
    const worstDow = [...sumByDow.entries()]
      .map(([dow, { sum, count }]) => ({ dow, avg: sum / count }))
      .reduce((a, b) => (b.avg < a.avg ? b : a)).dow;
    return DAY_NAMES[worstDow];
  }
}
