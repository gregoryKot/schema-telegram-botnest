// Резервные коды 2FA: в БД — только шифрованные хеши, хеш совместим с уже
// выданными кодами, старый формат колонки (массив) читается, погашение —
// одноразовое (CAS по блобу; гонка — totp.service.spec.ts).
process.env.ENCRYPTION_KEY = 'cc'.repeat(32);
process.env.ENCRYPTION_KEY_OLD = '';

import * as crypto from 'crypto';
import type { Logger } from '@nestjs/common';
import {
  consumeRecoveryCode,
  hashRecoveryCode,
  newRecoveryCodes,
  readRecoveryHashes,
} from './totp-recovery';

const USER = 7n;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const logger = { warn: jest.fn() } as unknown as Logger;

/** user.updateMany с CAS по блобу, как jsonb-равенство в Postgres. */
function fakePrisma(blob: unknown) {
  const row = { totpRecoveryCodes: blob };
  const updateMany = jest.fn(
    ({
      where,
      data,
    }: {
      where: { totpRecoveryCodes: { equals: unknown } };
      data: { totpRecoveryCodes: unknown };
    }) => {
      if (where.totpRecoveryCodes.equals !== row.totpRecoveryCodes)
        return Promise.resolve({ count: 0 });
      row.totpRecoveryCodes = data.totpRecoveryCodes;
      return Promise.resolve({ count: 1 });
    },
  );
  return { row, prisma: { user: { updateMany } } as never };
}

describe('hashRecoveryCode', () => {
  // Хеши выданных кодов уже лежат в БД: смена нормализации молча убила бы их.
  it('sha256 от кода без краёвых пробелов в нижнем регистре', () => {
    expect(hashRecoveryCode('  AbC12dEf90 ')).toBe(sha('abc12def90'));
  });
});

describe('newRecoveryCodes', () => {
  it('10 разных кодов по 10 hex; в колонке шифротекст, а не хеши открытым JSON', () => {
    const { codes, stored } = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[0-9a-f]{10}$/);
    expect(stored).not.toContain(hashRecoveryCode(codes[0]));
    expect(readRecoveryHashes(stored)).toEqual(codes.map(hashRecoveryCode));
  });
});

describe('readRecoveryHashes', () => {
  it('старый формат колонки — массив хешей открытым видом', () => {
    expect(readRecoveryHashes(['h1', 'h2'])).toEqual(['h1', 'h2']);
  });

  it.each([
    ['пусто (null)', null],
    ['строка не JSON', 'не json'],
    ['число', 5],
  ])('%s → нет кодов', (_, raw) => {
    expect(readRecoveryHashes(raw)).toEqual([]);
  });
});

describe('consumeRecoveryCode', () => {
  it('гасит ровно этот код, остаток пишет шифротекстом', async () => {
    const { codes, stored } = newRecoveryCodes();
    const { row, prisma } = fakePrisma(stored);
    await expect(
      consumeRecoveryCode(prisma, logger, USER, stored, codes[3]),
    ).resolves.toBe(true);
    const left = readRecoveryHashes(row.totpRecoveryCodes);
    expect(left).toEqual(codes.filter((_, i) => i !== 3).map(hashRecoveryCode));
    expect(row.totpRecoveryCodes).not.toContain(hashRecoveryCode(codes[0]));
  });

  it('чужой код → false, колонка не тронута', async () => {
    const { stored } = newRecoveryCodes();
    const { row, prisma } = fakePrisma(stored);
    await expect(
      consumeRecoveryCode(prisma, logger, USER, stored, 'ffffffffff'),
    ).resolves.toBe(false);
    expect(row.totpRecoveryCodes).toBe(stored);
  });

  it('блоб поменялся между чтением и записью (гонка) → false', async () => {
    const { codes, stored } = newRecoveryCodes();
    const { prisma } = fakePrisma('другой блоб');
    await expect(
      consumeRecoveryCode(prisma, logger, USER, stored, codes[0]),
    ).resolves.toBe(false);
  });
});
