import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NeedId, NEED_IDS } from './bot.service';

@Injectable()
export class BotAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private localDateString(tz: string, base = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(base);
  }

  private async userTimezone(userId: number): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { notifyTimezone: true },
    });
    return user?.notifyTimezone ?? 'Europe/Moscow';
  }

  async getHistoryRatings(userId: number, days: number): Promise<Array<{ date: string; ratings: Partial<Record<NeedId, number>> }>> {
    const tz = await this.userTimezone(userId);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.localDateString(tz, d);
    });
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId), date: { in: dates } } });
    const byDate = new Map<string, Partial<Record<NeedId, number>>>();
    for (const row of rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      byDate.get(row.date)![row.needId as NeedId] = row.value;
    }
    return dates.filter((d) => byDate.has(d)).map((d) => ({ date: d, ratings: byDate.get(d)! }));
  }

  async getLowStreakNeeds(userId: number, threshold: number, days: number): Promise<NeedId[]> {
    const tz = await this.userTimezone(userId);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.localDateString(tz, d);
    });
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId), date: { in: dates } } });
    return NEED_IDS.filter((needId) => {
      const needRows = rows.filter((r) => r.needId === needId);
      return needRows.length === days && needRows.every((r) => r.value < threshold);
    });
  }

  async getConsecutiveDays(userId: number): Promise<number> {
    const tz = await this.userTimezone(userId);
    const rows = await this.prisma.rating.findMany({
      where: { userId: BigInt(userId) },
      select: { date: true },
      distinct: ['date'],
    });
    const dates = new Set(rows.map((r) => r.date));
    let count = 0;
    while (true) {
      const dateStr = this.localDateString(tz, new Date(Date.now() - count * 86_400_000));
      if (!dates.has(dateStr)) break;
      count++;
    }
    return count;
  }

  async getTotalDaysFilled(userId: number): Promise<number> {
    const rows = await this.prisma.rating.findMany({
      where: { userId: BigInt(userId) },
      select: { date: true },
      distinct: ['date'],
    });
    return rows.length;
  }

  async getDaysSinceLastFill(userId: number): Promise<number> {
    const last = await this.prisma.rating.findFirst({
      where: { userId: BigInt(userId) },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!last) return -1;
    const tz = await this.userTimezone(userId);
    const today = this.localDateString(tz);
    const diffMs = new Date(today + 'T00:00:00Z').getTime() - new Date(last.date + 'T00:00:00Z').getTime();
    return Math.floor(diffMs / 86_400_000);
  }

  async getWeeklyStats(userId: number): Promise<Array<{ needId: NeedId; avg: number | null; trend: '↑' | '↓' | '→' }>> {
    const tz = await this.userTimezone(userId);
    const last14 = Array.from({ length: 14 }, (_, i) =>
      this.localDateString(tz, new Date(Date.now() - i * 86_400_000)),
    );
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId), date: { in: last14 } } });
    const curSet = new Set(last14.slice(0, 7));
    const prevSet = new Set(last14.slice(7));

    return NEED_IDS.map((needId) => {
      const cur = rows.filter((r) => r.needId === needId && curSet.has(r.date));
      const prev = rows.filter((r) => r.needId === needId && prevSet.has(r.date));
      const avg = cur.length ? cur.reduce((s, r) => s + r.value, 0) / cur.length : null;
      const prevAvg = prev.length ? prev.reduce((s, r) => s + r.value, 0) / prev.length : null;
      const trend: '↑' | '↓' | '→' =
        avg !== null && prevAvg !== null && avg - prevAvg > 0.5 ? '↑'
        : avg !== null && prevAvg !== null && avg - prevAvg < -0.5 ? '↓'
        : '→';
      return { needId, avg, trend };
    });
  }

  async getAchievements(userId: number): Promise<Array<{ id: string; earned: boolean }>> {
    const streak = await this.getStreakData(userId);
    const total = streak.totalDays;
    const longest = streak.longestStreak;

    // Check for high index day or all-needs day
    const rows = await this.prisma.rating.findMany({
      where: { userId: BigInt(userId) },
      select: { date: true, needId: true, value: true },
    });
    const byDate = new Map<string, Record<string, number>>();
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date, {});
      byDate.get(r.date)![r.needId] = r.value;
    }
    let hasHighDay = false, hasAllAbove7 = false, hasGrowth = false, hasComeBack = false;
    for (const [, ratings] of byDate) {
      const vals = Object.values(ratings);
      if (vals.length === 5) {
        const avg = vals.reduce((s, v) => s + v, 0) / 5;
        if (avg >= 8) hasHighDay = true;
        if (vals.every(v => v >= 7)) hasAllAbove7 = true;
      }
    }
    // comeback: sorted dates, find gap >= 3 then resumption
    const sorted = [...byDate.keys()].sort();
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + 'T12:00:00Z');
      const cur  = new Date(sorted[i]     + 'T12:00:00Z');
      if (Math.round((cur.getTime() - prev.getTime()) / 86_400_000) >= 3) { hasComeBack = true; break; }
    }
    // growth: compare last 7 days vs prev 7 days per need
    const tz = await this.userTimezone(userId);
    const last14 = Array.from({ length: 14 }, (_, i) =>
      this.localDateString(tz, new Date(Date.now() - i * 86_400_000)),
    );
    const recent = rows.filter(r => last14.slice(0, 7).includes(r.date));
    const older  = rows.filter(r => last14.slice(7).includes(r.date));
    for (const needId of NEED_IDS) {
      const r = recent.filter(r => r.needId === needId);
      const o = older.filter(r => r.needId === needId);
      if (r.length && o.length) {
        const rAvg = r.reduce((s, x) => s + x.value, 0) / r.length;
        const oAvg = o.reduce((s, x) => s + x.value, 0) / o.length;
        if (rAvg - oAvg >= 3) { hasGrowth = true; break; }
      }
    }

    return [
      { id: 'first_day',  earned: total >= 1 },
      { id: 'streak_3',   earned: longest >= 3 },
      { id: 'streak_7',   earned: longest >= 7 },
      { id: 'streak_14',  earned: longest >= 14 },
      { id: 'streak_30',  earned: longest >= 30 },
      { id: 'streak_100', earned: longest >= 100 },
      { id: 'total_10',   earned: total >= 10 },
      { id: 'total_50',   earned: total >= 50 },
      { id: 'high_day',   earned: hasHighDay },
      { id: 'all_above7', earned: hasAllAbove7 },
      { id: 'comeback',   earned: hasComeBack },
      { id: 'growth',     earned: hasGrowth },
    ];
  }

  /** Collect all active dates from any source: ratings, diaries, or explicit app activity. */
  private async getActiveDates(userId: number): Promise<Set<string>> {
    const uid = BigInt(userId);
    const [ratings, activity, schema, mode, gratitude] = await Promise.all([
      this.prisma.rating.findMany({ where: { userId: uid }, select: { date: true }, distinct: ['date'] }),
      this.prisma.appActivity.findMany({ where: { userId: uid }, select: { date: true } }),
      this.prisma.schemaDiaryEntry.findMany({ where: { userId: uid }, select: { createdAt: true } }),
      this.prisma.modeDiaryEntry.findMany({ where: { userId: uid }, select: { createdAt: true } }),
      this.prisma.gratitudeDiaryEntry.findMany({ where: { userId: uid }, select: { date: true } }),
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

  async recordActivity(userId: number): Promise<{ ok: boolean }> {
    const tz = await this.userTimezone(userId);
    const date = this.localDateString(tz);
    await this.prisma.appActivity.upsert({
      where: { userId_date: { userId: BigInt(userId), date } },
      create: { userId: BigInt(userId), date },
      update: {},
    });
    return { ok: true };
  }

  async getStreakData(userId: number): Promise<{
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
      const d = this.localDateString(tz, new Date(Date.now() - (startOffset + currentStreak) * 86_400_000));
      if (!dates.has(d)) break;
      currentStreak++;
    }

    // longest streak — scan sorted distinct dates
    const sorted = [...dates].sort();
    let longest = 0, run = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) { run = 1; continue; }
      const prev = new Date(sorted[i - 1] + 'T12:00:00Z');
      const cur  = new Date(sorted[i]     + 'T12:00:00Z');
      const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
      run = diffDays === 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }
    if (currentStreak > longest) longest = currentStreak;

    // week dots — current calendar week Mon–Sun (future days = false)
    const [ty, tm, td] = today.split('-').map(Number);
    const todayUtcNoon = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));
    const todayDow = (todayUtcNoon.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
    const weekDots = Array.from({ length: 7 }, (_, i) => {
      if (i > todayDow) return false; // future day
      const dayDate = new Date(todayUtcNoon.getTime() + (i - todayDow) * 86_400_000);
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

  async getBestDayOfWeek(userId: number): Promise<string | null> {
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId) } });
    if (rows.length === 0) return null;
    const sumByDow = new Map<number, { sum: number; count: number }>();
    const DAY_NAMES = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const sumByDate = new Map<string, number>();
    for (const r of rows) sumByDate.set(r.date, (sumByDate.get(r.date) ?? 0) + r.value);
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

  async getAdminStats(): Promise<string> {
    const now = new Date();
    const today = this.localDateString('UTC', now);
    const d7 = this.localDateString('UTC', new Date(now.getTime() - 7 * 86_400_000));
    const d30 = this.localDateString('UTC', new Date(now.getTime() - 30 * 86_400_000));
    const ago7 = new Date(now.getTime() - 7 * 86_400_000);
    const ago30 = new Date(now.getTime() - 30 * 86_400_000);

    const [
      totalUsers, newUsers7, newUsers30, notifyOff, blockedUsers,
      activePairs,
      todayRatings, week7Ratings, month30Ratings,
      needAvgs,
      fillsByDow,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: ago7 } } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: ago30 } } }),
      this.prisma.user.count({ where: { deletedAt: null, notifyEnabled: false } }),
      this.prisma.user.count({ where: { deletedAt: null, botBlockedAt: { not: null } } }),
      this.prisma.pair.count({ where: { status: 'active' } }),
      this.prisma.rating.findMany({ where: { date: today }, select: { userId: true }, distinct: ['userId'] }),
      this.prisma.rating.findMany({ where: { date: { gte: d7 } }, select: { userId: true }, distinct: ['userId'] }),
      this.prisma.rating.findMany({ where: { date: { gte: d30 } }, select: { userId: true }, distinct: ['userId'] }),
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

    // Retention funnel — count users with N+ distinct fill days
    const fillDates = await this.prisma.rating.findMany({ select: { userId: true, date: true }, distinct: ['userId', 'date'] });
    const fillsPerUser = new Map<string, number>();
    for (const r of fillDates) {
      const k = String(r.userId);
      fillsPerUser.set(k, (fillsPerUser.get(k) ?? 0) + 1);
    }
    const ret1 = [...fillsPerUser.values()].filter(n => n >= 1).length;
    const ret3 = [...fillsPerUser.values()].filter(n => n >= 3).length;
    const ret7 = [...fillsPerUser.values()].filter(n => n >= 7).length;
    const ret30 = [...fillsPerUser.values()].filter(n => n >= 30).length;

    // Churn signal: active in d7-d30 but NOT in last 7 days
    const activeRecent = new Set(week7Ratings.map(r => String(r.userId)));
    const activeOlder = new Set(
      await this.prisma.rating.findMany({ where: { date: { gte: d30, lt: d7 } }, select: { userId: true }, distinct: ['userId'] })
        .then(rows => rows.map(r => String(r.userId)))
    );
    const churnRisk = [...activeOlder].filter(id => !activeRecent.has(id)).length;

    // Most neglected need (lowest avg this week)
    const lowestNeed = needAvgs[0];
    const needLabels: Record<string, string> = { attachment: 'Привязанность', autonomy: 'Автономия', expression: 'Выражение чувств', play: 'Спонтанность', limits: 'Границы' };

    // Best fill day of week (last 30 days) — count user-day pairs per DOW
    const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const dowCounts = new Array(7).fill(0);
    for (const r of fillsByDow) {
      dowCounts[new Date(r.date + 'T12:00:00Z').getUTCDay()]++;
    }
    const bestDow = dowCounts.indexOf(Math.max(...dowCounts));
    const fillRate = month30Ratings.length > 0 ? Math.round((todayRatings.length / month30Ratings.length) * 100) : 0;

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
      lowestNeed ? `Западает: ${needLabels[lowestNeed.needId] ?? lowestNeed.needId} (avg ${lowestNeed._avg.value?.toFixed(1)})` : 'Нет данных по потребностям',
      `Лучший день для заполнения: ${DOW[bestDow]}`,
      '',
      `💑 <b>Пары</b>`,
      `Активных пар: ${activePairs}`,
    ];

    return lines.join('\n');
  }

  async getWorstDayOfWeek(userId: number): Promise<string | null> {
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId) } });
    if (rows.length === 0) return null;
    const sumByDow = new Map<number, { sum: number; count: number }>();
    const DAY_NAMES = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    // Group by day of week using all historical data
    const sumByDate = new Map<string, number>();
    for (const r of rows) sumByDate.set(r.date, (sumByDate.get(r.date) ?? 0) + r.value);
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
