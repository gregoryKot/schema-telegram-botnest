import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  encrypt,
  encryptJson,
  decryptRecord,
  type EncryptSchema,
} from '../utils/crypto';
import { deleteOwned, requireFound } from '../utils/require-affected';
import { GRATITUDE_DIARY_SCHEMA, saveGratitudeDay } from './gratitude-merge';
import { createdAtPage, datePage, type DiaryKind } from './diary-page';

// Расшифровка записи — одна на чтение (GET) и на ответ записи (POST).
// Инцидент 2026-10-26: create возвращал строку из БД, расшифровав поля
// списком вручную, и пропустил schemaIds/modeId — сайт получал шифротекст
// вместо массива и ронял раздел на `schemaIds.map`. Сверка «ответ записи =
// GET той же записи» с настоящим ключом — encrypted-write-response.spec.ts.
export const SCHEMA_DIARY_SCHEMA: EncryptSchema = {
  model: 'schemaDiaryEntry',
  strings: [
    'trigger',
    'thoughts',
    'bodyFeelings',
    'actualBehavior',
    'schemaOrigin',
    'healthyView',
    'realProblems',
    'excessiveReactions',
    'healthyBehavior',
  ],
  // Метки схем и эмоции — зашифрованный JSON; легаси-строки с массивом
  // (Prisma Json) decryptRecord отдаёт как есть.
  jsonArrays: ['emotions', 'schemaIds'],
};
export const MODE_DIARY_SCHEMA: EncryptSchema = {
  model: 'modeDiaryEntry',
  strings: [
    'modeId',
    'situation',
    'thoughts',
    'feelings',
    'bodyFeelings',
    'actions',
    'actualNeed',
    'childhoodMemories',
    'healthyResponse',
  ],
};

export interface EmotionEntry {
  id: string;
  intensity: number; // 1-5
}

@Injectable()
export class DiaryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Schema Diary ─────────────────────────────────────────────────────────

  async createSchemaDiaryEntry(
    userId: bigint,
    data: {
      trigger: string;
      emotions: EmotionEntry[];
      thoughts?: string;
      bodyFeelings?: string;
      actualBehavior?: string;
      schemaIds: string[];
      schemaOrigin?: string;
      healthyView?: string;
      realProblems?: string;
      excessiveReactions?: string;
      healthyBehavior?: string;
    },
  ) {
    const row = await this.prisma.schemaDiaryEntry.create({
      data: {
        userId,
        trigger: encrypt(data.trigger) ?? data.trigger,
        emotions: encryptJson(data.emotions) ?? JSON.stringify(data.emotions),
        thoughts: encrypt(data.thoughts),
        bodyFeelings: encrypt(data.bodyFeelings),
        actualBehavior: encrypt(data.actualBehavior),
        // Метки схем — зашифрованная JSON-строка (читает SCHEMA_DIARY_SCHEMA).
        schemaIds:
          encryptJson(data.schemaIds) ?? JSON.stringify(data.schemaIds),
        schemaOrigin: encrypt(data.schemaOrigin),
        healthyView: encrypt(data.healthyView),
        realProblems: encrypt(data.realProblems),
        excessiveReactions: encrypt(data.excessiveReactions),
        healthyBehavior: encrypt(data.healthyBehavior),
      },
    });
    return decryptRecord(row, SCHEMA_DIARY_SCHEMA);
  }

  async getSchemaDiaryEntries(userId: bigint, limit = 30) {
    const rows = await this.prisma.schemaDiaryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => decryptRecord(r, SCHEMA_DIARY_SCHEMA));
  }

  // Одна запись по id — её открывает «Мой путь» (R6: в списке только 30).
  async getSchemaDiaryEntry(userId: bigint, id: number) {
    const where = { id, userId };
    const row = this.prisma.schemaDiaryEntry.findFirst({ where });
    return decryptRecord(await requireFound(row), SCHEMA_DIARY_SCHEMA);
  }

  deleteSchemaDiaryEntry(userId: bigint, id: number) {
    return deleteOwned(this.prisma.schemaDiaryEntry, id, userId);
  }

  // ─── Mode Diary ───────────────────────────────────────────────────────────

  async createModeDiaryEntry(
    userId: bigint,
    data: {
      modeId: string;
      situation: string;
      thoughts?: string;
      feelings?: string;
      bodyFeelings?: string;
      actions?: string;
      actualNeed?: string;
      childhoodMemories?: string;
      healthyResponse?: string;
      /** Запись из потока «Что случилось» (маркер для «Записей» и /stats). */
      fromCase?: boolean;
    },
  ) {
    const row = await this.prisma.modeDiaryEntry.create({
      data: {
        userId,
        // Clinical label — encrypted on write, plaintext-tolerant on read.
        modeId: encrypt(data.modeId) ?? data.modeId,
        situation: encrypt(data.situation) ?? data.situation,
        thoughts: encrypt(data.thoughts),
        feelings: encrypt(data.feelings),
        bodyFeelings: encrypt(data.bodyFeelings),
        actions: encrypt(data.actions),
        actualNeed: encrypt(data.actualNeed),
        childhoodMemories: encrypt(data.childhoodMemories),
        healthyResponse: encrypt(data.healthyResponse),
        fromCase: data.fromCase === true,
      },
    });
    return decryptRecord(row, MODE_DIARY_SCHEMA);
  }

  async getModeDiaryEntries(userId: bigint, limit = 30) {
    const rows = await this.prisma.modeDiaryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => decryptRecord(r, MODE_DIARY_SCHEMA));
  }

  async getModeDiaryEntry(userId: bigint, id: number) {
    const where = { id, userId };
    const row = this.prisma.modeDiaryEntry.findFirst({ where });
    return decryptRecord(await requireFound(row), MODE_DIARY_SCHEMA);
  }

  deleteModeDiaryEntry(userId: bigint, id: number) {
    return deleteOwned(this.prisma.modeDiaryEntry, id, userId);
  }

  // ─── Gratitude Diary ──────────────────────────────────────────────────────

  // С `base` — слияние с днём на сервере, без него — замена (gratitude-merge.ts).
  upsertGratitudeDiaryEntry(
    userId: bigint,
    date: string,
    items: string[],
    base?: string[],
  ) {
    return saveGratitudeDay(this.prisma, userId, date, items, base);
  }

  async getGratitudeDiaryEntries(userId: bigint, limit = 30) {
    const rows = await this.prisma.gratitudeDiaryEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
    return rows.map((r) => decryptRecord(r, GRATITUDE_DIARY_SCHEMA));
  }

  async getGratitudeDiaryEntry(userId: bigint, id: number) {
    const where = { id, userId };
    const row = this.prisma.gratitudeDiaryEntry.findFirst({ where });
    return decryptRecord(await requireFound(row), GRATITUDE_DIARY_SCHEMA);
  }

  deleteGratitudeDiaryEntry(userId: bigint, id: number) {
    return deleteOwned(this.prisma.gratitudeDiaryEntry, id, userId);
  }

  // «Записи» → «Показать ещё»: страница старше записи `before` (diary-page.ts).
  getDiaryPage(userId: bigint, kind: DiaryKind, before?: number) {
    const p = this.prisma;
    if (kind === 'gratitude')
      return datePage(p.gratitudeDiaryEntry, userId, before, (r) =>
        decryptRecord(r, GRATITUDE_DIARY_SCHEMA),
      );
    if (kind === 'mode')
      return createdAtPage(p.modeDiaryEntry, userId, before, (r) =>
        decryptRecord(r, MODE_DIARY_SCHEMA),
      );
    return createdAtPage(p.schemaDiaryEntry, userId, before, (r) =>
      decryptRecord(r, SCHEMA_DIARY_SCHEMA),
    );
  }
}
