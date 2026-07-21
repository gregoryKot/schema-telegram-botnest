import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// «Мой путь» — сводный архив всей активности пользователя: сколько раз и когда
// он заполнял трекер, дневники, практики, тесты и упражнения. Лента отдаёт
// ТОЛЬКО нешифруемые поля (тип, дата, enum-идентификаторы needId/modeId/
// schemaId) — свободный текст пользователя здесь не читается и не
// расшифровывается вовсе. Счётчики — честные полные, из тех же выборок.

export type JourneyItemType =
  | 'tracker_day'
  | 'note'
  | 'schema_diary'
  | 'mode_diary'
  | 'gratitude'
  | 'practice'
  | 'plan_done'
  | 'ysq'
  | 'belief_check'
  | 'letter'
  | 'flashcard'
  | 'safe_place'
  | 'schema_note'
  | 'mode_note';

export interface JourneyItem {
  type: JourneyItemType;
  /** ISO-датавремя или YYYY-MM-DD (у дневных записей время не хранится) */
  at: string;
  /** id строки-источника — по нему фронт подтягивает содержимое записи
   * (через обычные расшифровывающие эндпоинты) для карточки-результата */
  id?: number;
  needId?: string;
  modeId?: string;
  schemaIds?: string[];
}

export interface JourneyCounts {
  trackerDays: number;
  notes: number;
  schemaDiary: number;
  modeDiary: number;
  gratitudeDays: number;
  practices: number;
  plansDone: number;
  ysqTests: number;
  childhoodDone: boolean;
  beliefChecks: number;
  letters: number;
  flashcards: number;
  safePlace: boolean;
  schemaNotes: number;
  modeNotes: number;
}

export interface JourneyData {
  counts: JourneyCounts;
  items: JourneyItem[];
}

// Потолок ленты: старое сверх лимита не отдаём (счётчики всё равно полные).
const FEED_LIMIT = 500;

const iso = (d: Date): string => d.toISOString();
const asIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];

@Injectable()
export class JourneyService {
  constructor(private readonly prisma: PrismaService) {}

  async getJourney(userId: bigint): Promise<JourneyData> {
    const p = this.prisma;
    const by = { userId };
    const [
      ratingDates,
      notes,
      schemaDiary,
      modeDiary,
      gratitude,
      practices,
      plansDone,
      ysqHistory,
      ysqResult,
      childhoodCount,
      beliefChecks,
      letters,
      flashcards,
      safePlace,
      schemaNotes,
      modeNotes,
    ] = await Promise.all([
      p.rating.groupBy({ by: ['date'], where: by }),
      p.note.findMany({ where: by, select: { date: true } }),
      p.schemaDiaryEntry.findMany({
        where: by,
        select: { id: true, createdAt: true, schemaIds: true },
      }),
      p.modeDiaryEntry.findMany({
        where: by,
        select: { id: true, createdAt: true, modeId: true },
      }),
      p.gratitudeDiaryEntry.findMany({
        where: by,
        select: { id: true, date: true },
      }),
      p.userPractice.findMany({
        where: by,
        select: { id: true, createdAt: true, needId: true },
      }),
      p.practicePlan.findMany({
        where: { userId, done: true },
        select: {
          id: true,
          checkedAt: true,
          scheduledDate: true,
          needId: true,
        },
      }),
      p.ysqResultHistory.findMany({ where: by, select: { completedAt: true } }),
      p.ysqResult.findUnique({
        where: { userId },
        select: { completedAt: true },
      }),
      p.childhoodRating.count({ where: by }),
      p.userBeliefCheck.findMany({
        where: by,
        select: { id: true, createdAt: true },
      }),
      p.userLetter.findMany({
        where: by,
        select: { id: true, createdAt: true },
      }),
      p.userFlashcard.findMany({
        where: by,
        select: { id: true, createdAt: true, modeId: true },
      }),
      p.userSafePlace.findUnique({
        where: { userId },
        select: { updatedAt: true },
      }),
      p.userSchemaNote.findMany({
        where: by,
        select: { updatedAt: true, schemaId: true },
      }),
      p.userModeNote.findMany({
        where: by,
        select: { updatedAt: true, modeId: true },
      }),
    ]);

    // Старые пользователи прошли тест до появления таблицы истории —
    // сам результат тогда единственный след прохождения.
    const ysqFeed = ysqHistory.length
      ? ysqHistory.map((h) => ({
          type: 'ysq' as const,
          at: iso(h.completedAt),
        }))
      : ysqResult
        ? [{ type: 'ysq' as const, at: iso(ysqResult.completedAt) }]
        : [];

    const items: JourneyItem[] = [
      ...ratingDates.map((r) => ({ type: 'tracker_day' as const, at: r.date })),
      ...notes.map((n) => ({ type: 'note' as const, at: n.date })),
      ...schemaDiary.map((e) => ({
        type: 'schema_diary' as const,
        id: e.id,
        at: iso(e.createdAt),
        schemaIds: asIds(e.schemaIds),
      })),
      ...modeDiary.map((e) => ({
        type: 'mode_diary' as const,
        id: e.id,
        at: iso(e.createdAt),
        modeId: e.modeId,
      })),
      ...gratitude.map((e) => ({
        type: 'gratitude' as const,
        id: e.id,
        at: e.date,
      })),
      ...practices.map((e) => ({
        type: 'practice' as const,
        id: e.id,
        at: iso(e.createdAt),
        needId: e.needId,
      })),
      ...plansDone.map((e) => ({
        type: 'plan_done' as const,
        id: e.id,
        at: e.checkedAt ? iso(e.checkedAt) : e.scheduledDate,
        needId: e.needId,
      })),
      ...ysqFeed,
      ...beliefChecks.map((e) => ({
        type: 'belief_check' as const,
        id: e.id,
        at: iso(e.createdAt),
      })),
      ...letters.map((e) => ({
        type: 'letter' as const,
        id: e.id,
        at: iso(e.createdAt),
      })),
      ...flashcards.map((e) => ({
        type: 'flashcard' as const,
        id: e.id,
        at: iso(e.createdAt),
        modeId: e.modeId,
      })),
      ...(safePlace
        ? [{ type: 'safe_place' as const, at: iso(safePlace.updatedAt) }]
        : []),
      ...schemaNotes.map((e) => ({
        type: 'schema_note' as const,
        at: iso(e.updatedAt),
        schemaIds: [e.schemaId],
      })),
      ...modeNotes.map((e) => ({
        type: 'mode_note' as const,
        at: iso(e.updatedAt),
        modeId: e.modeId,
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, FEED_LIMIT);

    return {
      counts: {
        trackerDays: ratingDates.length,
        notes: notes.length,
        schemaDiary: schemaDiary.length,
        modeDiary: modeDiary.length,
        gratitudeDays: gratitude.length,
        practices: practices.length,
        plansDone: plansDone.length,
        ysqTests: ysqFeed.length,
        childhoodDone: childhoodCount > 0,
        beliefChecks: beliefChecks.length,
        letters: letters.length,
        flashcards: flashcards.length,
        safePlace: safePlace !== null,
        schemaNotes: schemaNotes.length,
        modeNotes: modeNotes.length,
      },
      items,
    };
  }
}
