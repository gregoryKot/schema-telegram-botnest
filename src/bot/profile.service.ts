import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotAnalyticsService } from './bot.analytics.service';

// YSQ schema → diary ID mapping (order matches YSQTestSheet.tsx SCHEMAS array)
const YSQ_SCHEMAS: { id: string; questions: number[] }[] = [
  { id: 'emotional_deprivation',     questions: [1,2,3,4,5] },
  { id: 'abandonment',               questions: [6,7,8,9,10,11,12,13] },
  { id: 'mistrust',                  questions: [14,15,16,17,18] },
  { id: 'social_isolation',          questions: [19,20,21,22,23] },
  { id: 'defectiveness',             questions: [24,25,26,27,28,29] },
  { id: 'failure',                   questions: [30,31,32,33,34,35] },
  { id: 'dependence',                questions: [36,37,38,39,40,41,42,43] },
  { id: 'vulnerability',             questions: [44,45,46,47,48,49] },
  { id: 'enmeshment',                questions: [50,51,52,53,54,55,56] },
  { id: 'subjugation',               questions: [57,58,59,60,61] },
  { id: 'self_sacrifice',            questions: [62,63,64,65,66,67] },
  { id: 'emotion_inhibition_fear',   questions: [68,69,70,71] },
  { id: 'emotional_inhibition',      questions: [72,73,74,75,76] },
  { id: 'unrelenting_standards',     questions: [77,78,79,80,81,82,83] },
  { id: 'entitlement',               questions: [84,85,86,87,88,89] },
  { id: 'insufficient_self_control', questions: [90,91,92,93,94,95,96] },
  { id: 'approval_seeking',          questions: [97,98,99,100,101] },
  { id: 'negativity',                questions: [102,103,104,105,106,107] },
  { id: 'punitiveness_self',         questions: [108,109,110,111,112] },
  { id: 'punitiveness_others',       questions: [113,114,115,116] },
];

// A schema is active when >50% of its questions are scored ≥5 (same threshold as schema-miniapp)
function computeActiveSchemaIds(answers: number[]): string[] {
  return YSQ_SCHEMAS.filter(s => {
    const pct5plus = Math.round(
      s.questions.filter(q => (answers[q - 1] ?? 0) >= 5).length / s.questions.length * 100,
    );
    return pct5plus > 50;
  }).map(s => s.id);
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

  async getProfile(userId: number): Promise<UserProfile> {
    const uid = BigInt(userId);

    const [user, ysqResult, streakData, lastSchema, lastMode, lastGratitude, lastRating] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: uid } }),
      this.prisma.ysqResult.findUnique({ where: { userId: uid } }),
      this.analytics.getStreakData(userId),
      this.prisma.schemaDiaryEntry.findFirst({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      this.prisma.modeDiaryEntry.findFirst({ where: { userId: uid }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      this.prisma.gratitudeDiaryEntry.findFirst({ where: { userId: uid }, orderBy: { date: 'desc' }, select: { date: true } }),
      this.prisma.rating.findFirst({ where: { userId: uid }, orderBy: { date: 'desc' }, select: { date: true } }),
    ]);

    return {
      name: user?.firstName ?? null,
      role: (user?.role ?? 'CLIENT') as 'CLIENT' | 'THERAPIST',
      ysq: {
        completedAt: ysqResult?.completedAt ?? null,
        activeSchemaIds: ysqResult ? computeActiveSchemaIds(ysqResult.answers as number[]) : [],
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
        schemaDiary: lastSchema ? lastSchema.createdAt.toISOString().split('T')[0] : null,
        modeDiary: lastMode ? lastMode.createdAt.toISOString().split('T')[0] : null,
        gratitudeDiary: lastGratitude?.date ?? null,
      },
      mySchemaIds: (user?.mySchemaIds as string[] | null) ?? [],
      myModeIds: (user?.myModeIds as string[] | null) ?? [],
    };
  }
}
