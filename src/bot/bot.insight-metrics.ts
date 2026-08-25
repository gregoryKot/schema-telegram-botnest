import { PrismaService } from '../prisma/prisma.service';
import { NeedId, NEED_IDS } from './bot.service';
import { localDate } from '../utils/tz';
import { userTimezone } from './user-tz';
import { ActivityStreakMetrics } from './bot.activity-streak';

const DAY_NAMES = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

// Инсайты по истории: недельная динамика, «портрет», ачивки, лучший/худший
// день недели. Вынесено из BotAnalyticsService (правило №10); публичный API
// остался на фасаде bot.analytics.service.ts.
export class InsightMetrics {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streak: ActivityStreakMetrics,
  ) {}

  async getWeeklyStats(
    userId: bigint,
    tzArg?: string,
  ): Promise<
    Array<{ needId: NeedId; avg: number | null; trend: '↑' | '↓' | '→' }>
  > {
    const tz = tzArg ?? (await userTimezone(this.prisma, userId));
    const last14 = Array.from({ length: 14 }, (_, i) =>
      localDate(tz, new Date(Date.now() - i * 86_400_000)),
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
    const streak = await this.streak.getStreakData(userId);
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
    const tz = await userTimezone(this.prisma, userId);
    const last14 = Array.from({ length: 14 }, (_, i) =>
      localDate(tz, new Date(Date.now() - i * 86_400_000)),
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

  // Лучший И худший день недели за всю историю — ОДИН скан (аудит 2026-08, H4:
  // /insights звал getBestDayOfWeek и getWorstDayOfWeek раздельно и грузил
  // историю рейтингов дважды; методы были копией друг друга). Поведение
  // идентично прежнему: порог ≥3 разных дней недели, avg по дню недели,
  // best = max avg, worst = min avg (при равенстве — первый по порядку).
  async getDayOfWeekExtremes(
    userId: bigint,
  ): Promise<{ best: string | null; worst: string | null }> {
    const rows = await this.prisma.rating.findMany({
      where: { userId },
      select: { date: true, value: true },
    });
    if (rows.length === 0) return { best: null, worst: null };
    const sumByDate = new Map<string, number>();
    for (const r of rows)
      sumByDate.set(r.date, (sumByDate.get(r.date) ?? 0) + r.value);
    const sumByDow = new Map<number, { sum: number; count: number }>();
    for (const [date, sum] of sumByDate) {
      const dow = new Date(date + 'T12:00:00Z').getUTCDay();
      const cur = sumByDow.get(dow) ?? { sum: 0, count: 0 };
      sumByDow.set(dow, { sum: cur.sum + sum, count: cur.count + 1 });
    }
    if (sumByDow.size < 3) return { best: null, worst: null };
    const avgs = [...sumByDow.entries()].map(([dow, { sum, count }]) => ({
      dow,
      avg: sum / count,
    }));
    const best = avgs.reduce((a, b) => (b.avg > a.avg ? b : a)).dow;
    const worst = avgs.reduce((a, b) => (b.avg < a.avg ? b : a)).dow;
    return { best: DAY_NAMES[best], worst: DAY_NAMES[worst] };
  }
}
