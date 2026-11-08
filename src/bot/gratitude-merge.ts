// Слияние пунктов дня в дневнике благодарности (docs/open/frontend-ux.md, P0).
//
// День хранится одной записью `GratitudeDiaryEntry.items`. Раньше сохранение
// заменяло пункты целиком: клиент читал день, дописывал свой пункт и писал
// всё обратно, а пункт, добавленный между чтением и записью с другой вкладки
// или площадки, пропадал без ошибки.
//
// Теперь клиент присылает вместе с новыми пунктами `base` — пункты дня, какими
// он их видел. Трёхстороннее слияние: пункт есть в базе и пропал у клиента —
// клиент его убрал или переписал, не возвращаем; пункта нет в базе, но он есть
// на сервере — его добавили в другом месте, сохраняем на его месте
// относительно соседей. Пункты сравниваются по тексту без краёвых пробелов.
// Без `base` — прежняя замена целиком (старые клиенты, кэш мини-аппа до
// пересборки).
import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { encryptJson } from '../utils/crypto';
import {
  assertWritable,
  decryptRecord,
  type EncryptSchema,
} from '../utils/crypto-record';

const MERGE_RETRIES = 3;

const key = (s: string) => s.trim();

/**
 * @param current пункты дня на сервере сейчас
 * @param base    пункты дня, с которых клиент начинал правку
 * @param next    пункты, которые клиент сохраняет
 */
export function mergeGratitudeItems(
  current: readonly string[],
  base: readonly string[],
  next: readonly string[],
): string[] {
  const seenByClient = new Set(base.map(key));
  const result = [...next];
  // Куда вставлять пункт, которого клиент не видел: сразу после ближайшего
  // предыдущего пункта сервера, который остался в результате.
  let insertAt = 0;
  for (const item of current) {
    const k = key(item);
    if (!k) continue;
    const at = result.findIndex((r) => key(r) === k);
    if (at >= 0) {
      insertAt = at + 1;
      continue;
    }
    if (seenByClient.has(k)) continue;
    result.splice(insertAt, 0, item);
    insertAt++;
  }
  return result;
}

const encItems = (items: string[]) =>
  encryptJson(items) ?? JSON.stringify(items);

export const GRATITUDE_DIARY_SCHEMA: EncryptSchema = {
  model: 'gratitudeDiaryEntry',
  jsonArrays: ['items'],
};

/**
 * Пункты дня перед записью поверх них. Легаси-строка может лежать
 * JSON-массивом без шифрования. Шифротекст, который сейчас не читается (ключ
 * не подошёл), раньше давал `[]` — и сохранение навсегда стирало прежние
 * пункты (E15, аудит 2026-11). Теперь 409 { reason: 'unreadable_data' }.
 */
function readDay(row: { items: unknown } | null, where: string): string[] {
  if (!row) return [];
  const dec = decryptRecord(row, GRATITUDE_DIARY_SCHEMA);
  assertWritable(dec, ['items'], where);
  const items = Array.isArray(dec.items) ? (dec.items as unknown[]) : [];
  return items.filter((x): x is string => typeof x === 'string');
}

/**
 * Сохраняет пункты дня и возвращает запись с расшифрованными пунктами.
 * Слияние читает и пишет день в одной транзакции уровня Serializable: из двух
 * параллельных сохранений одного дня второе получает P2034 (или P2002 на
 * одновременном создании) и перечитывает день уже с пунктом первого.
 * READ COMMITTED не годился: оба прочли бы день до чужой записи.
 */
export async function saveGratitudeDay(
  prisma: PrismaService,
  userId: bigint,
  date: string,
  items: string[],
  base?: string[],
) {
  const where = { userId_date: { userId, date } };
  const label = `gratitude user#${userId} ${date}`;
  if (base === undefined) {
    readDay(await prisma.gratitudeDiaryEntry.findUnique({ where }), label);
    const enc = encItems(items);
    const row = await prisma.gratitudeDiaryEntry.upsert({
      where,
      create: { userId, date, items: enc },
      update: { items: enc },
    });
    return { ...row, items };
  }
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.gratitudeDiaryEntry.findUnique({ where });
          const current = readDay(existing, label);
          const merged = mergeGratitudeItems(current, base, items);
          const enc = encItems(merged);
          const row = await tx.gratitudeDiaryEntry.upsert({
            where,
            create: { userId, date, items: enc },
            update: { items: enc },
          });
          return { ...row, items: merged };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== 'P2034' && code !== 'P2002') throw err;
      if (attempt >= MERGE_RETRIES) {
        throw new ConflictException('Gratitude day changed concurrently');
      }
    }
  }
}
