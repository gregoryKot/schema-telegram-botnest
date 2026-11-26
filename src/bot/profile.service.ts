import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotAnalyticsService } from './bot.analytics.service';
import { computeActiveSchemas } from '../utils/ysq';
import { decryptRecord, unreadableFields } from '../utils/crypto';
import { decodeYsqAnswers } from './ysq.service';

function toStringArray(val: unknown): string[] {
  return Array.isArray(val) ? (val as string[]) : [];
}

const MY_LISTS = ['mySchemaIds', 'myModeIds'] as const;
type MyList = (typeof MY_LISTS)[number];

export interface UserProfile {
  name: string | null;
  role: 'CLIENT' | 'THERAPIST';
  ysq: {
    completedAt: Date | null;
    activeSchemaIds: string[];
  };
  notifications: {
    enabled: boolean;
    reminderEnabled: boolean;
    timezone: string;
    localHour: number;
  };
  streak: number;
  lastActivity: {
    needsTracker: string | null;
    schemaDiary: string | null;
    modeDiary: string | null;
    gratitudeDiary: string | null;
  };
  mySchemaIds: string[];
  myModeIds: string[];
  /**
   * Списки, которые сейчас не расшифровываются (ключ не подошёл): в
   * `mySchemaIds`/`myModeIds` для них `[]`, но это не «пусто». Клиент не
   * затирает свой локальный выбор этим `[]` — запись поверх всё равно
   * отбивается 409 (`assertWritable`), и после перезагрузки выбор пропадал
   * с экрана (docs/open/frontend-ux.md, 2026-11).
   */
  unreadableLists: MyList[];
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: BotAnalyticsService,
  ) {}

  async getProfile(userId: bigint): Promise<UserProfile> {
    const [
      user,
      ysqResult,
      streakData,
      lastSchema,
      lastMode,
      lastGratitude,
      lastRating,
    ] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.ysqResult.findUnique({ where: { userId } }),
      this.analytics.getStreakData(userId),
      this.prisma.schemaDiaryEntry.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.modeDiaryEntry.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.gratitudeDiaryEntry.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
      this.prisma.rating.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ]);
    const lists = user
      ? decryptRecord(user, { model: 'User', jsonArrays: [...MY_LISTS] })
      : null;
    const unreadable = lists ? unreadableFields(lists) : [];

    return {
      name: user?.firstName ?? null,
      role: user?.role ?? 'CLIENT',
      ysq: {
        completedAt: ysqResult?.completedAt ?? null,
        activeSchemaIds: ysqResult
          ? computeActiveSchemas(decodeYsqAnswers(ysqResult.answers))
          : [],
      },
      notifications: {
        enabled: user?.notifyEnabled ?? true,
        reminderEnabled: user?.notifyReminderEnabled ?? true,
        timezone: user?.notifyTimezone ?? 'Europe/Moscow',
        localHour: user?.notifyLocalHour ?? 21,
      },
      streak: streakData.currentStreak,
      lastActivity: {
        needsTracker: lastRating?.date ?? null,
        schemaDiary: lastSchema
          ? lastSchema.createdAt.toISOString().split('T')[0]
          : null,
        modeDiary: lastMode
          ? lastMode.createdAt.toISOString().split('T')[0]
          : null,
        gratitudeDiary: lastGratitude?.date ?? null,
      },
      mySchemaIds: toStringArray(lists?.mySchemaIds),
      myModeIds: toStringArray(lists?.myModeIds),
      unreadableLists: MY_LISTS.filter((f) => unreadable.includes(f)),
    };
  }
}
