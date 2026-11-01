import { ConflictException, Logger } from '@nestjs/common';
import { encrypt, encryptJson, tryDecrypt } from './crypto';

// ── Record-level encryption ──────────────────────────────────────────────────
// Declare a schema once, use it for both write (encryptRecord) and read (decryptRecord).
// This ensures every field is always encrypted/decrypted consistently.
//
// Usage:
//   const MY_SCHEMA: EncryptSchema = { strings: ['text', 'reframe'], jsonArrays: ['items'] };
//   const row = await prisma.myModel.create({ data: encryptRecord(data, MY_SCHEMA) });
//   return decryptRecord(row, MY_SCHEMA);

export interface EncryptSchema {
  strings?: string[]; // fields to encrypt/decrypt as plain strings
  jsonArrays?: string[]; // fields to encrypt/decrypt as JSON-encoded arrays
  /** Таблица для сообщения о провале расшифровки (в логе без неё — только имена полей). */
  model?: string;
}

export function encryptRecord<T extends Record<string, unknown>>(
  data: T,
  schema: EncryptSchema,
): T {
  const out: Record<string, unknown> = { ...data };
  for (const f of schema.strings ?? []) {
    if (out[f] != null) out[f] = encrypt(out[f] as string);
  }
  for (const f of schema.jsonArrays ?? []) {
    if (out[f] != null) out[f] = encryptJson(out[f]) ?? JSON.stringify(out[f]);
  }
  return out as T;
}

// Маркер «поле не прочиталось» лежит под Symbol-ключом: он переживает
// `{...row}` у вызывающих, но не попадает ни в JSON-ответ API, ни в Object.keys.
// Symbol.for, а не Symbol(): общий реестр, поэтому маркер узнаётся и между
// двумя копиями модуля (jest.isolateModules, дубль в бандле).
const UNREADABLE: unique symbol = Symbol.for('schema-botnest.unreadableFields');
type Marked = { [UNREADABLE]?: string[] };

/** Имена полей, которые decryptRecord не смог прочитать (пусто — всё прочиталось). */
export function unreadableFields(row: object): string[] {
  return (row as Marked)[UNREADABLE] ?? [];
}

type Parsed = { ok: true; value: unknown } | { ok: false };

// jsonArrays-поле, пришедшее строкой: шифротекст либо легаси-JSON-текст.
// Массив из строки-блоба нельзя сделать никак — поэтому провал отдельный исход,
// а не «вернуть строку»: строка в роли списка даёт подстрочные `.includes`.
// `[]` подставляется и там, где в поле лежал объект (DiaryDraft.data,
// YsqProgress/YsqResult.answers, ScheduledNotification.payload): по форме
// «не прочиталось» от «пусто» не отличить, видно только по маркеру
// (`unreadableFields`, в выгрузке — `_unreadableFields`).
function parseJsonField(v: string): Parsed {
  const r = tryDecrypt(v);
  if (!r.ok && r.looksCipher) return { ok: false };
  try {
    const value: unknown = JSON.parse(r.ok ? r.text : v);
    return value === null ? { ok: false } : { ok: true, value };
  } catch {
    return { ok: false };
  }
}

export function decryptRecord<T extends Record<string, unknown>>(
  row: T,
  schema: EncryptSchema,
): T {
  const out: Record<string, unknown> = { ...row };
  const bad: string[] = [];
  for (const f of schema.strings ?? []) {
    const r = tryDecrypt(out[f] as string | null | undefined);
    if (r.ok) out[f] = r.text;
    // Решение владельца 2026-10-04 (fail-open): текст остаётся сырым значением,
    // но провал виден — в маркере и в логе.
    else if (r.looksCipher) bad.push(f);
  }
  for (const f of schema.jsonArrays ?? []) {
    const v = out[f];
    // Forward-compat: if Prisma already deserialised the JSON column into an
    // array/object (legacy plaintext rows), return as-is. Only attempt
    // decrypt+parse when the column comes back as a string (new encrypted form).
    if (typeof v !== 'string') continue;
    const p = parseJsonField(v);
    if (p.ok) out[f] = p.value;
    else {
      out[f] = [];
      bad.push(f);
    }
  }
  if (bad.length > 0) {
    (out as Marked)[UNREADABLE] = [...unreadableFields(row), ...bad];
    reportUnreadable(schema.model, bad);
  }
  return out as T;
}

// ── Сигнал о провале ─────────────────────────────────────────────────────────
// Сообщение уходит владельцу в DM (error → AlertLogger), поэтому троттлинг:
// не чаще раза в минуту, а за это время копится счёт и имена. Содержимого —
// ни шифротекста, ни текста — в сообщении нет. Масштаб по всей базе даёт проба
// самопроверки encryptionReadable (счёт в процессе обнуляется при деплое и
// расходится между инстансами, поэтому здесь он только «за окно»).
const logger = new Logger('Crypto');
const WINDOW_MS = 60_000;
const MAX_NAMES = 10;
let lastLogAt = 0;
let suppressed = 0;
const names = new Set<string>();

function reportUnreadable(model: string | undefined, fields: string[]): void {
  for (const f of fields) names.add(model ? `${model}.${f}` : f);
  suppressed += fields.length;
  const now = Date.now();
  if (now - lastLogAt < WINDOW_MS) return;
  lastLogAt = now;
  const list = [...names].slice(0, MAX_NAMES).join(', ');
  const total = suppressed;
  names.clear();
  suppressed = 0;
  logger.error(
    `[crypto] decryptRecord: не прочиталось значений: ${total} (${list}) — ` +
      'ключ не подошёл, возможна порча данных или неполная ротация ENCRYPTION_KEY; ' +
      'масштаб по таблицам — проба encryptionReadable в /stats',
  );
}

// ── Запись поверх нечитаемого ────────────────────────────────────────────────
// Нечитаемое поле уходит в API как `[]` (или сырой строкой), клиент присылает
// своё значение целиком — запись затёрла бы живой шифротекст навсегда. Запись
// целого поля идёт через guardOverwrite с именами полей, которые пишет.
// Содержимого в логе и ответе нет; `reason` тела 409 — код для фронтендов.
export const UNWRITABLE_REASON = 'unreadable_data';
const UNWRITABLE_MESSAGE =
  'Правка не сохранена: записанные данные сейчас не читаются, и новая запись ' +
  'стёрла бы их. Нужна помощь владельца проекта.';

export function assertWritable(
  row: object,
  fields: readonly string[],
  where: string,
): void {
  const bad = unreadableFields(row).filter((f) => fields.includes(f));
  if (bad.length === 0) return;
  logger.warn(
    `[crypto] запись отклонена (409): ${where}, не читаются: ${bad.join(', ')}; ` +
      'запись затёрла бы нечитаемый шифротекст',
  );
  const body = { message: UNWRITABLE_MESSAGE, reason: UNWRITABLE_REASON };
  throw new ConflictException(body);
}

/** decryptRecord + assertWritable: строка, поля которой сейчас перезапишут. */
export function guardOverwrite(
  row: Record<string, unknown>,
  schema: EncryptSchema,
  fields: object,
  where: string,
): void {
  assertWritable(decryptRecord(row, schema), Object.keys(fields), where);
}
