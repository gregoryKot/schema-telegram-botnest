// R3 (аудит 2026-11): при слиянии аккаунтов запись источника, у которой у цели
// есть пара с тем же уникальным ключом, раньше молча удалялась шагом
// DELETE…EXISTS из UNIQUE_RULES (merge.service.ts). Теперь до этого шага, в той
// же транзакции, источник вливается в строку цели:
//   Note                — тексты за день склеиваются, метки объединяются;
//   GratitudeDiaryEntry — пункты обоих за день, без повторов;
//   UserSchemaNote/UserModeNote — пустые поля цели дополняются источником;
//   UserSafePlace       — остаётся более свежее описание (пустое дополняется);
//   YsqResult           — остаётся более свежий итог, прежний — в YsqResultHistory.
// Потом общий DELETE…EXISTS удаляет уже влитую строку источника.
// Нечитаемый шифротекст (ключ не подошёл) не перезаписывается: строка цели
// остаётся как есть, пара считается в `unreadable` (сигнал владельцу шлёт сам
// decryptRecord, с троттлингом).
import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  decryptRecord,
  encryptRecord,
  unreadableFields,
  type EncryptSchema,
} from '../utils/crypto';
import { MODE_NOTE_SCHEMA, SCHEMA_NOTE_SCHEMA } from '../bot/notes.service';
import { GRATITUDE_DIARY_SCHEMA } from '../bot/gratitude-merge';
import {
  fillEmptyFields,
  joinDayNotes,
  joinGratitudeItems,
  joinTags,
  newerFirst,
} from './merge-combine-rules';

export type CombineDb = Pick<
  Prisma.TransactionClient,
  | 'note'
  | 'gratitudeDiaryEntry'
  | 'userSchemaNote'
  | 'userModeNote'
  | 'userSafePlace'
  | 'ysqResult'
  | 'ysqResultHistory'
>;

/** false — пару не объединить (шифротекст не читается), цель не тронута. */
type Fix = (tx: CombineDb) => Promise<boolean>;
type Finder = (db: CombineDb, src: bigint, tgt: bigint) => Promise<Fix[]>;

export interface CombineOutcome {
  combined: number;
  unreadable: number;
}

const NOTE_SCHEMA: EncryptSchema = { model: 'note', strings: ['text', 'tags'] };
const SAFE_PLACE_SCHEMA: EncryptSchema = {
  model: 'userSafePlace',
  strings: ['description'],
};

/** Пары [цель, источник] с одним ключом; rows — строки обоих аккаунтов. */
function pairs<R extends { userId: bigint }>(
  rows: R[],
  src: bigint,
  key: (r: R) => string,
): Array<[R, R]> {
  const tgt = new Map<string, R>();
  for (const r of rows) if (r.userId !== src) tgt.set(key(r), r);
  return rows.flatMap((s) => {
    const t = s.userId === src ? tgt.get(key(s)) : undefined;
    return t ? [[t, s] as [R, R]] : [];
  });
}

/** Обе строки расшифрованы; null — хоть одно поле не прочиталось. */
function readBoth<R extends Record<string, unknown>>(
  t: R,
  s: R,
  schema: EncryptSchema,
): [R, R] | null {
  const dt = decryptRecord(t, schema);
  const ds = decryptRecord(s, schema);
  const bad = unreadableFields(dt).length + unreadableFields(ds).length;
  return bad > 0 ? null : [dt, ds];
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const both = (src: bigint, tgt: bigint) => ({ userId: { in: [src, tgt] } });

const dayNotes: Finder = async (db, src, tgt) => {
  const rows = await db.note.findMany({ where: both(src, tgt) });
  return pairs(rows, src, (r) => r.date).map(([t, s]) => async (tx) => {
    const read = readBoth(t, s, NOTE_SCHEMA);
    if (!read) return false;
    const [dt, ds] = read;
    const data = {
      text: joinDayNotes(dt.text, ds.text),
      tags: joinTags(dt.tags, ds.tags),
    };
    const enc = encryptRecord(data, NOTE_SCHEMA);
    await tx.note.update({ where: { id: t.id }, data: enc });
    return true;
  });
};

const gratitude: Finder = async (db, src, tgt) => {
  const rows = await db.gratitudeDiaryEntry.findMany({ where: both(src, tgt) });
  return pairs(rows, src, (r) => r.date).map(([t, s]) => async (tx) => {
    const read = readBoth(t, s, GRATITUDE_DIARY_SCHEMA);
    if (!read) return false;
    const items = joinGratitudeItems(
      strings(read[0].items),
      strings(read[1].items),
    );
    const enc = encryptRecord({ items }, GRATITUDE_DIARY_SCHEMA);
    await tx.gratitudeDiaryEntry.update({ where: { id: t.id }, data: enc });
    return true;
  });
};

/** Поля карточки для записи в цель; null — не читается. */
function fillCard<R extends Record<string, unknown>>(
  t: R,
  s: R,
  schema: EncryptSchema,
): Record<string, string> | null {
  const read = readBoth(t, s, schema);
  if (!read) return null;
  const fill = fillEmptyFields(read[0], read[1], schema.strings ?? []);
  return encryptRecord(fill, schema);
}

const schemaCards: Finder = async (db, src, tgt) => {
  const rows = await db.userSchemaNote.findMany({ where: both(src, tgt) });
  return pairs(rows, src, (r) => r.schemaId).map(([t, s]) => async (tx) => {
    const data = fillCard(t, s, SCHEMA_NOTE_SCHEMA);
    if (data) await tx.userSchemaNote.update({ where: { id: t.id }, data });
    return data !== null;
  });
};

const modeCards: Finder = async (db, src, tgt) => {
  const rows = await db.userModeNote.findMany({ where: both(src, tgt) });
  return pairs(rows, src, (r) => r.modeId).map(([t, s]) => async (tx) => {
    const data = fillCard(t, s, MODE_NOTE_SCHEMA);
    if (data) await tx.userModeNote.update({ where: { id: t.id }, data });
    return data !== null;
  });
};

const safePlace: Finder = async (db, src, tgt) => {
  const rows = await db.userSafePlace.findMany({ where: both(src, tgt) });
  return pairs(rows, src, () => '').map(([t, s]) => async (tx) => {
    const read = readBoth(t, s, SAFE_PLACE_SCHEMA);
    if (!read) return false;
    const [newer, older] = newerFirst(read[0], read[1], (r) => r.updatedAt);
    const fill = fillEmptyFields(newer, older, ['description']);
    const description = fill.description ?? newer.description;
    const enc = encryptRecord({ description }, SAFE_PLACE_SCHEMA);
    await tx.userSafePlace.update({ where: { userId: tgt }, data: enc });
    return true;
  });
};

// Итог теста переносится шифротекстом как есть — расшифровка не нужна.
// Каждое прохождение пишет итог и строку истории одной транзакцией
// (ysq.service.ts), но у первого итога completedAt ставит DEFAULT базы, а у
// истории — часы приложения: строка ищется в окне (два прохождения одного
// человека за минуту невозможны), а не по равенству. У итогов до появления
// истории строки нет — её создаём.
const HISTORY_WINDOW_MS = 60_000;
const ysqResult: Finder = async (db, src, tgt) => {
  const rows = await db.ysqResult.findMany({ where: both(src, tgt) });
  return pairs(rows, src, () => '').map(([t, s]) => async (tx) => {
    const [newer, older] = newerFirst(t, s, (r) => r.completedAt);
    const { completedAt } = older;
    const answers = older.answers as Prisma.InputJsonValue;
    const at = completedAt.getTime();
    const kept = await tx.ysqResultHistory.findFirst({
      where: {
        userId: older.userId, // история ещё у владельца: ремап userId позже
        completedAt: {
          gte: new Date(at - HISTORY_WINDOW_MS),
          lte: new Date(at + HISTORY_WINDOW_MS),
        },
      },
      select: { id: true },
    });
    if (!kept) {
      await tx.ysqResultHistory.create({
        data: { userId: tgt, answers, completedAt },
      });
    }
    if (newer === s) {
      await tx.ysqResult.update({
        where: { userId: tgt },
        data: {
          answers: s.answers as Prisma.InputJsonValue,
          completedAt: s.completedAt,
        },
      });
    }
    return true;
  });
};

/** Таблицы UNIQUE_RULES, где пара объединяется, а не теряет строку источника. */
export const COMBINERS = {
  Note: dayNotes,
  GratitudeDiaryEntry: gratitude,
  UserSchemaNote: schemaCards,
  UserModeNote: modeCards,
  UserSafePlace: safePlace,
  YsqResult: ysqResult,
} satisfies Record<string, Finder>;
export const COMBINE_TABLES = Object.keys(COMBINERS);

const logger = new Logger('MergeCombine');

/**
 * Сколько записей источника объединится с записями цели (экран слияния).
 * Пары ищет тот же код, что объединяет, — число не разойдётся с делом.
 */
export async function countCombinable(
  db: CombineDb,
  src: bigint,
  tgt: bigint,
): Promise<number> {
  let n = 0;
  for (const [table, find] of Object.entries(COMBINERS)) {
    try {
      n += (await find(db, src, tgt)).length;
    } catch (err) {
      logger.error(`countCombinable ${table}: ${(err as Error).message}`);
    }
  }
  return n;
}

/** Влить пары в строки цели; звать в транзакции слияния до DELETE…EXISTS. */
export async function combineConflicts(
  tx: CombineDb,
  src: bigint,
  tgt: bigint,
): Promise<CombineOutcome> {
  const out: CombineOutcome = { combined: 0, unreadable: 0 };
  for (const [table, find] of Object.entries(COMBINERS)) {
    for (const fix of await find(tx, src, tgt)) {
      if (await fix(tx)) out.combined++;
      else {
        out.unreadable++;
        logger.warn(
          `merge ${src} → ${tgt}: ${table} — шифротекст не читается, ` +
            'осталась запись текущего аккаунта, запись второго не влита',
        );
      }
    }
  }
  return out;
}
