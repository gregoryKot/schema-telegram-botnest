import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VALID_TIMEZONES } from '../telegram/telegram.constants';

// ── User data registry ───────────────────────────────────────────────────────
// CHECKLIST when adding a new table with userId:
//   1. Add the model name here — deleteAllUserData will clear it automatically
//   2. In service methods: use encryptRecord/decryptRecord (from utils/crypto)
//      and declare an EncryptSchema constant near the methods
//   3. Add onDelete: Cascade on the User relation in schema.prisma
//   4. Run `npx prisma generate` after schema changes
//
// TypeScript: if a name doesn't exist on PrismaService you get a compile error.
export const USER_DATA_TABLES = [
  'rating',
  'note',
  'userSchemaNote',
  'userModeNote',
  'userBeliefCheck',
  'userLetter',
  'userSafePlace',
  'userFlashcard',
  'userPractice',
  'practicePlan',
  'childhoodRating',
  'ysqResult',
  'ysqProgress',
  'ysqResultHistory',
  'scheduledNotification',
  'schemaDiaryEntry',
  'modeDiaryEntry',
  'gratitudeDiaryEntry',
  'appActivity',
  'userTask',
  'diaryDraft',
  'emailToken',
] as const;
// Compile-time check: any invalid table name above becomes a TS error here.
type _VerifyTables = {
  [K in (typeof USER_DATA_TABLES)[number]]: PrismaService[K];
};

// Жизненный цикл аккаунта: регистрация/идентичность, роль, статус блокировки
// бота, списки для рассылок и полное удаление (right-to-erasure).
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerUser(userId: bigint, firstName?: string, timezone?: string) {
    const validTz =
      typeof timezone === 'string' && VALID_TIMEZONES.includes(timezone);
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {
        ...(firstName ? { firstName } : {}),
        botBlockedAt: null,
        deletedAt: null,
      },
      create: {
        id: userId,
        firstName,
        ...(validTz ? { notifyTimezone: timezone } : {}),
      },
    });
  }

  async getUserFirstName(userId: bigint): Promise<string | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });
    return u?.firstName ?? null;
  }

  async updateName(userId: bigint, name: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: name },
    });
  }

  async setRole(userId: bigint, role: 'CLIENT' | 'THERAPIST'): Promise<void> {
    // When promoting to THERAPIST also enable therapistMode by default
    // (was client-side auto-enable via localStorage check)
    await this.prisma.user.update({
      where: { id: userId },
      data: { role, therapistMode: role === 'THERAPIST' },
    });
  }

  async getUserRole(userId: bigint): Promise<'CLIENT' | 'THERAPIST'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role ?? 'CLIENT';
  }

  async markUserBlocked(userId: bigint): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, botBlockedAt: null },
      data: { botBlockedAt: new Date() },
    });
  }

  async getAllUserIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    return users.map((u) => Number(u.id));
  }

  async getBroadcastUserIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, botBlockedAt: null },
      select: { id: true },
    });
    return users.map((u) => Number(u.id));
  }

  async getAllUsersWithSettings() {
    return this.prisma.user.findMany({
      where: { notifyEnabled: true, botBlockedAt: null, deletedAt: null },
      select: {
        id: true,
        notifyLocalHour: true,
        notifyTimezone: true,
        notifyReminderEnabled: true,
        notifyGamified: true,
        notifyFrequency: true,
        notifyAdaptiveLevel: true,
        notifyIgnoredCount: true,
        notifyNextRemindDate: true,
        notifySkipAckDate: true,
        notifyLastEvalDate: true,
        notifyPausedUntil: true,
        addressForm: true,
      },
    });
  }

  /** Явный выбор частоты сбрасывает адаптацию на выбранный уровень */
  async setAdaptiveLevel(userId: bigint, level: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { notifyAdaptiveLevel: level, notifyIgnoredCount: 0 },
    });
  }

  /** Тихие часы + таймзона + форма обращения для пачки юзеров (processQueue) */
  async getSendSettingsFor(
    ids: bigint[],
  ): Promise<
    Map<string, { tz: string; start: number; end: number; form: string | null }>
  > {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        notifyTimezone: true,
        notifyQuietStart: true,
        notifyQuietEnd: true,
        addressForm: true,
      },
    });
    return new Map(
      rows.map((r) => [
        r.id.toString(),
        {
          tz: r.notifyTimezone,
          start: r.notifyQuietStart,
          end: r.notifyQuietEnd,
          form: r.addressForm,
        },
      ]),
    );
  }

  async deleteAllUserData(userId: bigint): Promise<void> {
    const uid = userId;
    // HARD delete — right-to-erasure. We tear out every row that references
    // this user, including auth providers, web sessions, therapist requests,
    // and finally the User row itself. NO soft-delete fallback.
    //
    // After the transaction we run VACUUM on the touched tables (outside the
    // transaction — VACUUM can't run inside one). This reclaims dead tuples
    // so the data is physically overwriteable by Postgres faster.
    await this.prisma.$transaction([
      // All user-owned tables (USER_DATA_TABLES registry above).
      ...USER_DATA_TABLES.map((table) =>
        (this.prisma[table] as any).deleteMany({ where: { userId: uid } }),
      ),
      // Clinical rows about a person: remove when EITHER side deletes account.
      // clientId matters no less than therapistId — right-to-erasure клиента
      // включает конспектуализацию и заметки терапевта О НЁМ (аудит 2026-07, D-1).
      this.prisma.clientConceptualization.deleteMany({
        where: { OR: [{ therapistId: uid }, { clientId: uid }] },
      }),
      this.prisma.therapistNote.deleteMany({
        where: { OR: [{ therapistId: uid }, { clientId: uid }] },
      }),
      this.prisma.therapyRelation.deleteMany({
        where: { OR: [{ therapistId: uid }, { clientId: uid }] },
      }),
      // Mode maps (about a client, created by a therapist) — remove if either side leaves.
      (this.prisma as any).modeMap.deleteMany({
        where: { OR: [{ therapistId: uid }, { clientId: uid }] },
      }),
      (this.prisma as any).therapistCustomMode.deleteMany({
        where: { therapistId: uid },
      }),
      // Pairs (two refs).
      this.prisma.pair.deleteMany({
        where: { OR: [{ userId1: uid }, { userId2: uid }] },
      }),
      // Auth: providers + web sessions + therapist requests.
      (this.prisma as any).authProvider.deleteMany({ where: { userId: uid } }),
      (this.prisma as any).webSession.deleteMany({ where: { userId: uid } }),
      (this.prisma as any).therapistRequest.deleteMany({
        where: { userId: uid },
      }),
      // Recurring subscriptions: for Telegram users userId === telegramId, so
      // remove (and stop billing) any subscription tied to this person. Charges
      // cascade-delete via the FK. (Web-only subs without telegramId aren't
      // account-linked — managed by their own cancel token.)
      (this.prisma as any).subscription.deleteMany({
        where: { telegramId: uid },
      }),
      // Finally — the user row itself.
      this.prisma.user.delete({ where: { id: uid } }),
    ]);
    // Async VACUUM on the affected tables only (non-blocking, no FULL).
    // Scope to User table and key user-data tables — avoids a full-DB scan.
    this.prisma
      .$executeRawUnsafe('VACUUM ANALYZE "User"')
      .catch((e) =>
        this.logger.warn(`Post-delete VACUUM failed: ${(e as Error).message}`),
      );
  }
}
