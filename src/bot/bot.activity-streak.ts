import { PrismaService } from '../prisma/prisma.service';
import { localDate } from '../utils/tz';
import { userTimezone } from './user-tz';

// Серия и активные дни — одно правило для бота, сайта и мини-аппа (QA
// 2026-11-03). Активный день — день хоть одной записи о себе: оценки трекера,
// записи дневников схем, режимов (в том числе разбор «Что случилось») и
// благодарности. Ровно то, что показывают «Записи» сайта.
//
// Открытие приложения (AppActivity) активностью НЕ считается. До QA оно
// считалось: сайт и мини-апп пишут визит на старте, и человек без единой
// записи получал «серию 1» и достижение «Первый шаг — первая запись в
// дневнике». Визиты остаются в AppActivity для удержания в /stats.
//
// Серия «жива», пока не кончился день: если сегодня записей ещё нет, счёт идёт
// со вчера. Бот (напоминания, вехи, «С возвращением») раньше считал только
// оценки и обнулял серию до первой оценки дня — строка «🔥 Серия» в
// напоминании, которое и приходит до оценки, поэтому не показывалась никогда.
// Вынесено из BotAnalyticsService (правило №10); публичный API — фасад
// bot.analytics.service.ts.

/** День `YYYY-MM-DD` со сдвигом на `delta` суток (календарный день — полночь UTC, правило №25). */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Текущая серия: дни подряд по `today`; сегодня без записей серию не рвёт. */
export function currentStreak(
  dates: ReadonlySet<string>,
  today: string,
): number {
  let day = dates.has(today) ? today : shiftDay(today, -1);
  let count = 0;
  while (dates.has(day)) {
    count++;
    day = shiftDay(day, -1);
  }
  return count;
}

/** Самая длинная серия за всю историю. */
export function longestStreak(dates: ReadonlySet<string>): number {
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of [...dates].sort()) {
    run = prev !== null && shiftDay(prev, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }
  return longest;
}

export class ActivityStreakMetrics {
  constructor(private readonly prisma: PrismaService) {}

  /** Дни с записями о себе (см. шапку файла) — в поясе юзера. */
  async getActiveDates(userId: bigint, tzArg?: string): Promise<Set<string>> {
    const uid = userId;
    const [ratings, schema, mode, gratitude] = await Promise.all([
      this.prisma.rating.findMany({
        where: { userId: uid },
        select: { date: true },
        distinct: ['date'],
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
    const tz = tzArg ?? (await userTimezone(this.prisma, userId));
    const set = new Set<string>();
    for (const r of ratings) set.add(r.date);
    for (const e of schema) set.add(localDate(tz, e.createdAt));
    for (const e of mode) set.add(localDate(tz, e.createdAt));
    for (const e of gratitude) set.add(e.date);
    return set;
  }

  /** Визит в приложение — для удержания в /stats; в серию не идёт. */
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

  /** Текущая серия для бота (напоминания, вехи, «С возвращением»). */
  async getCurrentStreak(userId: bigint, tzArg?: string): Promise<number> {
    const tz = tzArg ?? (await userTimezone(this.prisma, userId));
    const dates = await this.getActiveDates(userId, tz);
    return currentStreak(dates, localDate(tz));
  }

  async getStreakData(userId: bigint): Promise<{
    currentStreak: number;
    longestStreak: number;
    totalDays: number;
    todayDone: boolean;
    weekDots: boolean[];
  }> {
    const tz = await userTimezone(this.prisma, userId);
    const dates = await this.getActiveDates(userId, tz);
    const today = localDate(tz);
    const current = currentStreak(dates, today);

    // week dots — current calendar week Mon–Sun (future days = false)
    const [ty, tm, td] = today.split('-').map(Number);
    const todayDow = (new Date(Date.UTC(ty, tm - 1, td)).getUTCDay() + 6) % 7; // 0=Mon
    const weekDots = Array.from(
      { length: 7 },
      (_, i) => i <= todayDow && dates.has(shiftDay(today, i - todayDow)),
    );

    return {
      currentStreak: current,
      longestStreak: Math.max(longestStreak(dates), current),
      totalDays: dates.size,
      todayDone: dates.has(today),
      weekDots,
    };
  }
}
