// Аудит 2026-10, D-8: нечитаемый (чужой ключ) список mySchemaIds раньше
// возвращался из decryptRecord строкой-блобом, `Array.isArray(string)` давал
// пустой список, и сохранение карточки писало `[id]` ПОВЕРХ живого списка.
// Ключ выставляем ДО загрузки crypto.ts — иначе encrypt() no-op.
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

import { createCipheriv, randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';
import { decryptRecord, encryptJson } from '../utils/crypto';
import { addToMyList } from './notes-my-list';

/** Шифротекст нашего формата (iv+tag+data) под ДРУГИМ ключом. */
function encryptWithOtherKey(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.alloc(32, 9), iv, {
    authTagLength: 16,
  });
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

function makeDb(stored: { mySchemaIds: unknown } | null) {
  const db = {
    user: {
      findUnique: jest.fn(async () => stored),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(stored ?? {}, data);
      }),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  return db;
}

const call = (db: ReturnType<typeof makeDb>) =>
  addToMyList(db as never, 1n, 'mySchemaIds', 'abandonment');

describe('addToMyList: нечитаемый список не затирается', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('список под чужим ключом → записи нет, шифротекст в БД цел', async () => {
    const foreign = encryptWithOtherKey(JSON.stringify(['mistrust']));
    const stored = { mySchemaIds: foreign };
    const db = makeDb(stored);
    await call(db);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(stored.mySchemaIds).toBe(foreign);
  });

  it('читаемый список: id дописывается (read-after-write)', async () => {
    const stored = { mySchemaIds: encryptJson(['mistrust']) };
    const db = makeDb(stored);
    await call(db);
    const row = decryptRecord(stored, { jsonArrays: ['mySchemaIds'] });
    expect(row.mySchemaIds).toEqual(['mistrust', 'abandonment']);
  });

  it('пустой список (null в колонке) — тоже читаемый: id дописывается', async () => {
    const stored = { mySchemaIds: null as unknown };
    const db = makeDb(stored);
    await call(db);
    const row = decryptRecord(stored as { mySchemaIds: string }, {
      jsonArrays: ['mySchemaIds'],
    });
    expect(row.mySchemaIds).toEqual(['abandonment']);
  });

  it('пользователя нет → ничего не пишем', async () => {
    const db = makeDb(null);
    await expect(call(db)).resolves.toBeUndefined();
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
