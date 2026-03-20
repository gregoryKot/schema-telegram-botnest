import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NeedId, NEED_IDS } from './bot.service';

@Injectable()
export class BotAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private localDateString(tzOffsetHours = 0, base = new Date()): string {
    const local = new Date(base.getTime() + tzOffsetHours * 3600_000);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, '0');
    const d = String(local.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private async userTzOffset(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { notifyTzOffset: true },
    });
    return user?.notifyTzOffset ?? 0;
  }

  async getHistoryRatings(userId: number, days: number): Promise<Array<{ date: string; ratings: Partial<Record<NeedId, number>> }>> {
    const tzOffset = await this.userTzOffset(userId);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.localDateString(tzOffset, d);
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
    const tzOffset = await this.userTzOffset(userId);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.localDateString(tzOffset, d);
    });
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId), date: { in: dates } } });
    return NEED_IDS.filter((needId) => {
      const needRows = rows.filter((r) => r.needId === needId);
      return needRows.length === days && needRows.every((r) => r.value < threshold);
    });
  }

  async getConsecutiveDays(userId: number): Promise<number> {
    const tzOffset = await this.userTzOffset(userId);
    const rows = await this.prisma.rating.findMany({
      where: { userId: BigInt(userId) },
      select: { date: true },
      distinct: ['date'],
    });
    const dates = new Set(rows.map((r) => r.date));
    let count = 0;
    while (true) {
      const dateStr = this.localDateString(tzOffset, new Date(Date.now() - count * 86_400_000));
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
    const tzOffset = await this.userTzOffset(userId);
    const today = this.localDateString(tzOffset);
    const diffMs = new Date(today + 'T00:00:00Z').getTime() - new Date(last.date + 'T00:00:00Z').getTime();
    return Math.floor(diffMs / 86_400_000);
  }

  async getWeeklyStats(userId: number): Promise<Array<{ needId: NeedId; avg: number | null; trend: '↑' | '↓' | '→' }>> {
    const tzOffset = await this.userTzOffset(userId);
    const last14 = Array.from({ length: 14 }, (_, i) =>
      this.localDateString(tzOffset, new Date(Date.now() - i * 86_400_000)),
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
    const tzOffset = await this.userTzOffset(userId);
    const last14 = Array.from({ length: 14 }, (_, i) =>
      this.localDateString(tzOffset, new Date(Date.now() - i * 86_400_000)),
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

  async getStreakData(userId: number): Promise<{
    currentStreak: number;
    longestStreak: number;
    totalDays: number;
    todayDone: boolean;
    weekDots: boolean[];
  }> {
    const tzOffset = await this.userTzOffset(userId);
    const rows = await this.prisma.rating.findMany({
      where: { userId: BigInt(userId) },
      select: { date: true },
      distinct: ['date'],
    });
    const dates = new Set(rows.map((r) => r.date));
    const today = this.localDateString(tzOffset);

    // current streak — if today not yet filled, count from yesterday
    const startOffset = dates.has(today) ? 0 : 1;
    let currentStreak = 0;
    while (true) {
      const d = this.localDateString(tzOffset, new Date(Date.now() - (startOffset + currentStreak) * 86_400_000));
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

    // week dots — last 7 days (today first)
    const weekDots = Array.from({ length: 7 }, (_, i) =>
      dates.has(this.localDateString(tzOffset, new Date(Date.now() - i * 86_400_000))),
    ).reverse(); // Mon→Sun order (oldest first)

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
    const today = this.localDateString(0, now);
    const d7 = this.localDateString(0, new Date(now.getTime() - 7 * 86_400_000));
    const d30 = this.localDateString(0, new Date(now.getTime() - 30 * 86_400_000));
    const ago7 = new Date(now.getTime() - 7 * 86_400_000);
    const ago30 = new Date(now.getTime() - 30 * 86_400_000);

    const [
      totalUsers, newUsers7, newUsers30, notifyOff,
      activePairs,
      notifsSentTotal, notifsSent7,
      notifsPerType,
      pendingCount, overdueCount, pendingPerType,
      todayRatings, week7Ratings, month30Ratings,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: ago7 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: ago30 } } }),
      this.prisma.user.count({ where: { notifyEnabled: false } }),
      this.prisma.pair.count({ where: { status: 'active' } }),
      this.prisma.scheduledNotification.count({ where: { sentAt: { not: null } } }),
      this.prisma.scheduledNotification.count({ where: { sentAt: { gte: ago7 } } }),
      this.prisma.scheduledNotification.groupBy({
        by: ['type'],
        where: { sentAt: { gte: ago7 } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.scheduledNotification.count({ where: { sentAt: null, cancelledAt: null } }),
      this.prisma.scheduledNotification.count({ where: { sentAt: null, cancelledAt: null, sendAt: { lte: now } } }),
      this.prisma.scheduledNotification.groupBy({
        by: ['type'],
        where: { sentAt: null, cancelledAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.rating.findMany({ where: { date: today }, select: { userId: true }, distinct: ['userId'] }),
      this.prisma.rating.findMany({ where: { date: { gte: d7 } }, select: { userId: true }, distinct: ['userId'] }),
      this.prisma.rating.findMany({ where: { date: { gte: d30 } }, select: { userId: true }, distinct: ['userId'] }),
    ]);

    const typeBreakdown = notifsPerType.map(r => `  ${r.type}: ${r._count.id}`).join('\n');

    const lines = [
      `📊 <b>Статистика бота</b> · ${today}`,
      '',
      `👥 <b>Пользователи</b>`,
      `Всего: ${totalUsers} (новых за 7д: ${newUsers7}, за 30д: ${newUsers30})`,
      `Отключили уведомления: ${notifyOff}`,
      '',
      `📔 <b>Дневник</b>`,
      `Заполнили сегодня: ${todayRatings.length}`,
      `Активных за 7 дней: ${week7Ratings.length}`,
      `Активных за 30 дней: ${month30Ratings.length}`,
      '',
      `🔔 <b>Уведомления</b>`,
      `Отправлено всего: ${notifsSentTotal}`,
      `Отправлено за 7 дней: ${notifsSent7}`,
      `В очереди (pending): ${pendingCount} (из них просрочено: ${overdueCount})`,
      ...(pendingPerType.length ? [`Pending по типам: ${pendingPerType.map(r => `${r.type}:${r._count.id}`).join(', ')}`] : []),
      ...(typeBreakdown ? [`\nОтправлено за 7д по типам:\n${typeBreakdown}`] : []),
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
