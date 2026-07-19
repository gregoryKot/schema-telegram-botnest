import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotAnalyticsService } from './bot.analytics.service';
import { computeActiveSchemas } from '../utils/ysq';
import { decryptRecord } from '../utils/crypto';

function toStringArray(val: unknown): string[] {
  return Array.isArray(val) ? (val as string[]) : [];
}

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

    return {
      name: user?.firstName ?? null,
      role: user?.role ?? 'CLIENT',
      ysq: {
        completedAt: ysqResult?.completedAt ?? null,
        activeSchemaIds: ysqResult
          ? computeActiveSchemas(ysqResult.answers as number[])
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
      mySchemaIds: toStringArray(
        user
          ? decryptRecord(user, { jsonArrays: ['mySchemaIds'] }).mySchemaIds
          : null,
      ),
      myModeIds: toStringArray(
        user
          ? decryptRecord(user, { jsonArrays: ['myModeIds'] }).myModeIds
          : null,
      ),
    };
  }
}
