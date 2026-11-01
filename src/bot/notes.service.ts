import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';
import { addToMyList } from './notes-my-list';

// Поля, общие для карточки схемы и карточки режима — не копипастим список
// дважды (правило №4/№10 CLAUDE.md). Различаются только doc-специфичные
// поля: `reality` у схемы, `needs` у режима.
const COMMON_NOTE_FIELDS = [
  'triggers',
  'feelings',
  'thoughts',
  'origins',
  'healthyView',
  'behavior',
] as const;
type CommonNoteFields = {
  triggers?: string;
  feelings?: string;
  thoughts?: string;
  origins?: string;
  healthyView?: string;
  behavior?: string;
};

// Схемы шифрования — общий источник правды для NotesService (юзер) и
// TherapyClientDataService (терапевт читает те же таблицы, импортирует отсюда).
export const SCHEMA_NOTE_SCHEMA: EncryptSchema = {
  model: 'userSchemaNote',
  strings: [...COMMON_NOTE_FIELDS, 'reality'],
};
export const MODE_NOTE_SCHEMA: EncryptSchema = {
  model: 'userModeNote',
  strings: [
    ...COMMON_NOTE_FIELDS,
    'needs',
    'modeFunction',
    'needsMet',
    // Имя режима своими словами и «чего боишься, если он перестанет» —
    // свободный текст человека, шифруется наравне с остальной карточкой.
    'alias',
    'fear',
  ],
};

// Карточки схем/режимов (UserSchemaNote / UserModeNote) + доступ терапевта
// к карточкам клиента. Заполнение карточки обязано добавить её id в
// денормализованную коллекцию профиля (mySchemaIds/myModeIds) — иначе архив
// «Мои записи» её не найдёт (см. notes.service.spec.ts).
@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async getSchemaNote(userId: bigint, schemaId: string) {
    const row = await this.prisma.userSchemaNote.findUnique({
      where: { userId_schemaId: { userId, schemaId } },
    });
    return row ? decryptRecord(row, SCHEMA_NOTE_SCHEMA) : null;
  }

  async getSchemaNotes(userId: bigint) {
    const rows = await this.prisma.userSchemaNote.findMany({
      where: { userId },
    });
    return rows.map((r) => decryptRecord(r, SCHEMA_NOTE_SCHEMA));
  }

  async upsertSchemaNote(
    userId: bigint,
    schemaId: string,
    data: CommonNoteFields & { reality?: string },
  ) {
    const enc = encryptRecord(data, SCHEMA_NOTE_SCHEMA);
    const res = await this.prisma.userSchemaNote.upsert({
      where: { userId_schemaId: { userId, schemaId } },
      update: enc,
      create: { userId, schemaId, ...enc },
    });
    // Заполненная карточка = схема в коллекции юзера, иначе её не найти в «Моих записях».
    await addToMyList(this.prisma, userId, 'mySchemaIds', schemaId);
    return decryptRecord(res, SCHEMA_NOTE_SCHEMA); // как GET (encrypted-write-response.spec.ts)
  }

  async getModeNote(userId: bigint, modeId: string) {
    const row = await this.prisma.userModeNote.findUnique({
      where: { userId_modeId: { userId, modeId } },
    });
    return row ? decryptRecord(row, MODE_NOTE_SCHEMA) : null;
  }

  async getModeNotes(userId: bigint) {
    const rows = await this.prisma.userModeNote.findMany({ where: { userId } });
    return rows.map((r) => decryptRecord(r, MODE_NOTE_SCHEMA));
  }

  async upsertModeNote(
    userId: bigint,
    modeId: string,
    data: CommonNoteFields & {
      needs?: string;
      modeFunction?: string;
      needsMet?: string;
      alias?: string;
      fear?: string;
    },
  ) {
    const enc = encryptRecord(data, MODE_NOTE_SCHEMA);
    const res = await this.prisma.userModeNote.upsert({
      where: { userId_modeId: { userId, modeId } },
      update: enc,
      create: { userId, modeId, ...enc },
    });
    await addToMyList(this.prisma, userId, 'myModeIds', modeId);
    return decryptRecord(res, MODE_NOTE_SCHEMA);
  }
}
// Доступ терапевта к карточкам клиента жил здесь дублем (без расшифровки!) —
// единственная реализация теперь в therapy-client-data.service (assertHasClient
// + therapistShareCards + decryptRecord).
