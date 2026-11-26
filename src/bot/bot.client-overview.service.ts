import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NeedId } from './bot.service';
import { localDate } from '../utils/tz';
import { readClientStreaks } from './client-streaks';

// Батч-обзор клиентов терапевта (стрик, давность, история за 14 дней) одним
// набором запросов. Вынесено из BotAnalyticsService (правило №10): единственный
// потребитель — терапевтская сторона (TherapyRelationsService).
//
// Все дни — по календарю КЛИЕНТА (notifyTimezone, по умолчанию Москва): в нём
// POST /api/rating без даты кладёт оценку. recentDays[0] — сегодня клиента;
// терапевт сверяет оценки с этими днями, а не со своим или UTC-днём (QA
// 2026-10-26: в 00:10 по Москве сегодняшняя оценка клиента пропадала).
export interface ClientOverview {
  streak: number;
  daysSince: number; // -1 — оценок не было
  lastDate: string | null; // день последней оценки
  recentDays: string[]; // 14 дней клиента, [0] — его сегодня
  history: Array<{ date: string; ratings: Partial<Record<NeedId, number>> }>;
}

@Injectable()
export class BotClientOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  private localDateString(tz: string, base = new Date()): string {
    return localDate(tz, base);
  }

  async getClientOverviews(
    userIds: bigint[],
  ): Promise<Map<string, ClientOverview>> {
    const out = new Map<string, ClientOverview>();
    if (userIds.length === 0) return out;

    // 1) Таймзоны всех клиентов одним запросом.
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, notifyTimezone: true },
    });
    const tzById = new Map(
      users.map((u) => [String(u.id), u.notifyTimezone ?? 'Europe/Moscow']),
    );

    // 2) Стрик и день последней оценки — в SQL, без общего потолка строк
    // (client-streaks.ts): «сегодня» у каждого клиента своё.
    const todayByUser = new Map(
      userIds.map((id) => [
        id,
        this.localDateString(tzById.get(String(id)) ?? 'Europe/Moscow'),
      ]),
    );
    const streaks = await readClientStreaks(this.prisma, todayByUser);

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
      const { streak, lastDate } = streaks.get(key) ?? {
        streak: 0,
        lastDate: null,
      };
      // Оценка «на завтра» (поставлена из зоны восточнее) — заполнял сегодня,
      // а не «−1 = не заполнял никогда».
      const daysSince = lastDate
        ? Math.max(
            0,
            (Date.parse(`${todayByUser.get(id)}T00:00:00Z`) -
              Date.parse(`${lastDate}T00:00:00Z`)) /
              86_400_000,
          )
        : -1;

      const recentDays = recentDatesByUser.get(key)!;
      const history = recentDays
        .filter((d) => ratingsByUserDate.has(`${key}|${d}`))
        .map((d) => ({
          date: d,
          ratings: ratingsByUserDate.get(`${key}|${d}`)!,
        }));

      out.set(key, { streak, daysSince, lastDate, recentDays, history });
    }
    return out;
  }
}
