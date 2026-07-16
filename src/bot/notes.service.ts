import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';

// Карточки схем/режимов (UserSchemaNote / UserModeNote) + доступ терапевта
// к карточкам клиента. Заполнение карточки обязано добавить её id в
// денормализованную коллекцию профиля (mySchemaIds/myModeIds) — иначе архив
// «Мои записи» её не найдёт (см. notes.service.spec.ts).
@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly SCHEMA_NOTE_SCHEMA: EncryptSchema = {
    strings: [
      'triggers',
      'feelings',
      'thoughts',
      'origins',
      'reality',
      'healthyView',
      'behavior',
    ],
  };
  private static readonly MODE_NOTE_SCHEMA: EncryptSchema = {
    strings: ['triggers', 'feelings', 'thoughts', 'needs', 'behavior'],
  };

  async getSchemaNote(userId: bigint, schemaId: string) {
    const row = await this.prisma.userSchemaNote.findUnique({
      where: { userId_schemaId: { userId, schemaId } },
    });
    return row ? decryptRecord(row, NotesService.SCHEMA_NOTE_SCHEMA) : null;
  }

  async getSchemaNotes(userId: bigint) {
    const rows = await this.prisma.userSchemaNote.findMany({
      where: { userId },
    });
    return rows.map((r) => decryptRecord(r, NotesService.SCHEMA_NOTE_SCHEMA));
  }

  async upsertSchemaNote(
    userId: bigint,
    schemaId: string,
    data: {
      triggers?: string;
      feelings?: string;
      thoughts?: string;
      origins?: string;
      reality?: string;
      healthyView?: string;
      behavior?: string;
    },
  ) {
    const enc = encryptRecord(data, NotesService.SCHEMA_NOTE_SCHEMA);
    const res = await this.prisma.userSchemaNote.upsert({
      where: { userId_schemaId: { userId, schemaId } },
      update: enc,
      create: { userId, schemaId, ...enc },
    });
    // Заполненная карточка = схема в коллекции юзера, иначе её не найти в «Моих записях».
    await this.addToMyList(userId, 'mySchemaIds', schemaId);
    return res;
  }

  // Добавляет id в зашифрованный json-массив профиля (mySchemaIds/myModeIds), если его там ещё нет.
  private async addToMyList(
    userId: bigint,
    field: 'mySchemaIds' | 'myModeIds',
    id: string,
  ) {
    // Read-modify-write по денормализованному зашифрованному списку — в
    // транзакции (аудит 2026-07, 2.2): конкурентные upsert'ы разных карточек
    // одного юзера гонялись за одним прочитанным списком → lost update.
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.findUnique({
        where: { id: userId },
        select: { [field]: true },
      });
      if (!row) return;
      const dec = decryptRecord(row as Record<string, unknown>, {
        jsonArrays: [field],
      });
      const list = Array.isArray(dec[field]) ? (dec[field] as string[]) : [];
      if (list.includes(id)) return;
      const enc = encryptRecord(
        { [field]: [...list, id] },
        { jsonArrays: [field] },
      );
      await tx.user.update({ where: { id: userId }, data: enc });
    });
  }

  async getModeNote(userId: bigint, modeId: string) {
    const row = await this.prisma.userModeNote.findUnique({
      where: { userId_modeId: { userId, modeId } },
    });
    return row ? decryptRecord(row, NotesService.MODE_NOTE_SCHEMA) : null;
  }

  async getModeNotes(userId: bigint) {
    const rows = await this.prisma.userModeNote.findMany({ where: { userId } });
    return rows.map((r) => decryptRecord(r, NotesService.MODE_NOTE_SCHEMA));
  }

  async upsertModeNote(
    userId: bigint,
    modeId: string,
    data: {
      triggers?: string;
      feelings?: string;
      thoughts?: string;
      needs?: string;
      behavior?: string;
    },
  ) {
    const enc = encryptRecord(data, NotesService.MODE_NOTE_SCHEMA);
    const res = await this.prisma.userModeNote.upsert({
      where: { userId_modeId: { userId, modeId } },
      update: enc,
      create: { userId, modeId, ...enc },
    });
    await this.addToMyList(userId, 'myModeIds', modeId);
    return res;
  }

  // ── Therapist: client notes access ───────────────────────────────────────────

  async getClientSchemaNotes(therapistId: bigint, clientId: bigint) {
    const [rel, client] = await Promise.all([
      this.prisma.therapyRelation.findFirst({
        where: { therapistId, clientId, status: 'active' },
      }),
      this.prisma.user.findUnique({
        where: { id: clientId },
        select: { therapistShareCards: true },
      }),
    ]);
    if (!rel) return null;
    if (client?.therapistShareCards === false) return [];
    return this.prisma.userSchemaNote.findMany({ where: { userId: clientId } });
  }

  async getClientModeNotes(therapistId: bigint, clientId: bigint) {
    const [rel, client] = await Promise.all([
      this.prisma.therapyRelation.findFirst({
        where: { therapistId, clientId, status: 'active' },
      }),
      this.prisma.user.findUnique({
        where: { id: clientId },
        select: { therapistShareCards: true },
      }),
    ]);
    if (!rel) return null;
    if (client?.therapistShareCards === false) return [];
    return this.prisma.userModeNote.findMany({ where: { userId: clientId } });
  }
}
