import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { localDate } from '../utils/tz';
import {
  encrypt,
  decrypt,
  encryptRecord,
  decryptRecord,
} from '../utils/crypto';

export const NEED_IDS = [
  'attachment',
  'autonomy',
  'expression',
  'play',
  'limits',
] as const;
export type NeedId = (typeof NEED_IDS)[number];

export interface Need {
  id: NeedId;
  emoji: string; // для сводки и идентификации
  title: string; // короткое — для кнопок
  fullTitle: string; // полное — для экрана оценки и FAQ
  chartLabel: string; // для диаграммы (без эмодзи)
}

// Ядро: потребности (needs), их оценки (ratings/childhood ratings), дневная
// заметка и настройки юзера. Остальные домены — в соседних сервисах
// (account/ysq/pairs/practices/exercises/notes.service.ts), см. bot.module.ts.
@Injectable()
export class BotService {
  private readonly needs: Need[] = [
    {
      id: 'attachment',
      emoji: '🤝',
      title: '🤝 Привязанность',
      fullTitle:
        'Безопасная привязанность\n(безопасность, стабильность, забота, принятие)',
      chartLabel: 'Привязанность',
    },
    {
      id: 'autonomy',
      emoji: '🚀',
      title: '🚀 Автономия',
      fullTitle: 'Автономия, компетентность и чувство идентичности',
      chartLabel: 'Автономия',
    },
    {
      id: 'expression',
      emoji: '💬',
      title: '💬 Выражение чувств',
      fullTitle: 'Свобода выражать потребности и эмоции',
      chartLabel: 'Выражение чувств',
    },
    {
      id: 'play',
      emoji: '🎉',
      title: '🎉 Спонтанность',
      fullTitle: 'Спонтанность и игра',
      chartLabel: 'Спонтанность',
    },
    {
      id: 'limits',
      emoji: '⚖️',
      title: '⚖️ Границы',
      fullTitle: 'Реалистичные границы и самоконтроль',
      chartLabel: 'Границы',
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  getNeeds(): Need[] {
    return this.needs;
  }

  // Единый источник — utils/tz.localDate (аудит 2026-07, 2в): раньше тело
  // Intl.DateTimeFormat дублировалось здесь и в notification.time.
  private localDateString(tz: string, base = new Date()): string {
    return localDate(tz, base);
  }

  private async userTimezone(userId: bigint): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notifyTimezone: true },
    });
    return user?.notifyTimezone ?? 'Europe/Moscow';
  }

  async acceptDisclaimer(userId: bigint): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { disclaimerAccepted: true },
    });
  }

  async hasAcceptedDisclaimer(userId: bigint): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { disclaimerAccepted: true },
    });
    return u?.disclaimerAccepted ?? false;
  }

  async getUserSettings(userId: bigint) {
    // Explicit select — only return fields used by the API. Adding a new
    // public setting? Add it here AND in api.controller.getSettings().
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        notifyEnabled: true,
        notifyLocalHour: true,
        notifyTimezone: true,
        notifyReminderEnabled: true,
        notifyFrequency: true,
        notifyQuietStart: true,
        notifyQuietEnd: true,
        notifyGamified: true,
        notifyPausedUntil: true,
        notifyNextRemindDate: true,
        addressForm: true,
        pairCardDismissed: true,
        mySchemaIds: true,
        myModeIds: true,
        therapistShareCards: true,
        therapistShareProfile: true,
      },
    });
    if (!row) return row;
    // Decrypt clinical labels if encrypted (forward-compat with plaintext rows).
    return decryptRecord(row, {
      jsonArrays: ['mySchemaIds', 'myModeIds'],
    });
  }

  async updateUserSettings(
    userId: bigint,
    data: {
      notifyEnabled?: boolean;
      notifyLocalHour?: number;
      notifyTimezone?: string;
      notifyReminderEnabled?: boolean;
      notifyFrequency?: number;
      notifyQuietStart?: number;
      notifyQuietEnd?: number;
      notifyGamified?: boolean;
      notifyPausedUntil?: Date | null;
      addressForm?: string;
      pairCardDismissed?: boolean;
      mySchemaIds?: string[];
      myModeIds?: string[];
      therapistShareCards?: boolean;
      therapistShareProfile?: boolean;
    },
  ) {
    const enc = encryptRecord(data as Record<string, unknown>, {
      jsonArrays: ['mySchemaIds', 'myModeIds'],
    });
    await this.prisma.user.update({ where: { id: userId }, data: enc });
  }

  async getNote(
    userId: bigint,
    date: string,
  ): Promise<{ text: string | null; tags: string[] }> {
    const note = await this.prisma.note.findUnique({
      where: { userId_date: { userId, date } },
    });
    return {
      text: note?.text ? decrypt(note.text) : null,
      // Tags: new rows store comma-joined encrypted blob; legacy rows store
      // comma-joined plaintext. decrypt() returns plaintext unchanged.
      tags: note?.tags
        ? (decrypt(note.tags) ?? '').split(',').filter(Boolean)
        : [],
    };
  }

  async saveNote(userId: bigint, date: string, text: string, tags?: string[]) {
    const tagsPlain = tags ? tags.join(',') : '';
    const encText = encrypt(text) ?? text;
    const encTags = encrypt(tagsPlain) ?? tagsPlain;
    await this.prisma.note.upsert({
      where: { userId_date: { userId, date } },
      update: { text: encText, tags: encTags },
      create: { userId, date, text: encText, tags: encTags },
    });
  }

  async saveRating(
    userId: bigint,
    needId: NeedId,
    value: number,
    date?: string,
  ) {
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new Error('Rating must be integer 0..10');
    }
    const dt = date ?? this.localDateString(await this.userTimezone(userId));
    await this.prisma.rating.upsert({
      where: { userId_date_needId: { userId, date: dt, needId } },
      update: { value },
      create: { userId, date: dt, needId, value },
    });
  }

  async getRatings(userId: bigint, date?: string) {
    const dt = date ?? this.localDateString(await this.userTimezone(userId));
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: dt },
    });
    return Object.fromEntries(rows.map((r) => [r.needId, r.value])) as Partial<
      Record<NeedId, number>
    >;
  }

  async cancelAllPreReminders(): Promise<number> {
    const result = await this.prisma.scheduledNotification.updateMany({
      where: { type: 'pre_reminder', sentAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    return result.count;
  }

  async getChildhoodRatings(
    userId: bigint,
  ): Promise<Partial<Record<string, number>>> {
    const rows = await this.prisma.childhoodRating.findMany({
      where: { userId },
    });
    const result: Partial<Record<string, number>> = {};
    for (const row of rows) result[row.needId] = row.value;
    return result;
  }

  async saveChildhoodRatings(
    userId: bigint,
    ratings: Record<string, number>,
  ): Promise<void> {
    await this.prisma.$transaction(
      Object.entries(ratings).map(([needId, value]) =>
        this.prisma.childhoodRating.upsert({
          where: { userId_needId: { userId, needId } },
          create: { userId, needId, value },
          update: { value },
        }),
      ),
    );
  }
}
