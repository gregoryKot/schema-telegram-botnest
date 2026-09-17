import { PrismaService } from '../prisma/prisma.service';
import { localDate } from '../utils/tz';
import { userTimezone } from './user-tz';

// Активность из любых источников (оценки, дневники, явная активность в аппе)
// и стрики по ней. Вынесено из BotAnalyticsService (правило №10); публичный
// API остался на фасаде bot.analytics.service.ts.
export class ActivityStreakMetrics {
  constructor(private readonly prisma: PrismaService) {}

  /** Collect all active dates from any source: ratings, diaries, or explicit app activity. */
  async getActiveDates(userId: bigint): Promise<Set<string>> {
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
    const tz = await userTimezone(this.prisma, userId);
    const set = new Set<string>();
    for (const r of ratings) set.add(r.date);
    for (const a of activity) set.add(a.date);
    for (const e of schema) set.add(localDate(tz, e.createdAt));
    for (const e of mode) set.add(localDate(tz, e.createdAt));
    for (const e of gratitude) set.add(e.date);
    return set;
  }

  async recordActivity(userId: bigint): Promise<{ ok: boolean }> {
    const tz = await userTimezone(this.prisma, userId);
    const date = localDate(tz);
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
    const tz = await userTimezone(this.prisma, userId);
    const dates = await this.getActiveDates(userId);
    const today = localDate(tz);

    // current streak — if today not yet filled, count from yesterday
    const startOffset = dates.has(today) ? 0 : 1;
    let currentStreak = 0;
    while (true) {
      const d = localDate(
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
      return dates.has(localDate(tz, dayDate));
    });

    return {
      currentStreak,
      longestStreak: longest,
      totalDays: dates.size,
      todayDone: dates.has(today),
      weekDots,
    };
  }
}
