// Сверка (правило №4): длина кода приглашения на бэкенде (INVITE_CODE_LENGTH,
// по ней генерируется код) и на фронтах (THERAPY_INVITE_CODE_LENGTH в
// shared/src/therapy/inviteCode.ts, по ней режется ввод в «Мой терапевт»).
// Инцидент 2026-10-26: сервер выдавал 12 знаков, поле ввода пускало 8, и
// подключиться по коду не мог никто — два места знали одно правило порознь.
// Бэкенд shared не импортирует, поэтому константа читается из файла.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  createTherapyInvite,
  INVITE_CODE_LENGTH,
  joinTherapyAsClient,
} from './therapy-invite';
import { makeRelationPrismaMock, type Rel } from './therapy.test-helpers';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('../telegram/telegram.constants', () => ({
  ...jest.requireActual('../telegram/telegram.constants'),
  BOT_USERNAME: 'SchemeHappensBot',
}));

const SHARED = join(
  __dirname,
  '..',
  '..',
  'shared',
  'src',
  'therapy',
  'inviteCode.ts',
);

function sharedConst(name: string): string {
  const m = new RegExp(`^export const ${name} = (.+);$`, 'm').exec(
    readFileSync(SHARED, 'utf8'),
  );
  if (!m) throw new Error(`${name} не найдена в ${SHARED}`);
  return m[1];
}

describe('код приглашения: бэкенд ↔ поле ввода фронтов', () => {
  it('длина кода в shared совпадает с бэкендом', () => {
    expect(Number(sharedConst('THERAPY_INVITE_CODE_LENGTH'))).toBe(
      INVITE_CODE_LENGTH,
    );
  });

  it('пример в поле ввода — той же длины и того же алфавита, что настоящий код', () => {
    const placeholder = JSON.parse(
      sharedConst('THERAPY_INVITE_CODE_PLACEHOLDER').replace(/'/g, '"'),
    ) as string;
    expect(placeholder).toMatch(
      new RegExp(`^[0-9A-F]{${INVITE_CODE_LENGTH}}$`),
    );
  });

  it('выданный код ровно этой длины, hex в верхнем регистре — и им подключаются', async () => {
    const rels: Rel[] = [];
    const prisma = makeRelationPrismaMock(rels) as unknown as PrismaService;
    for (let i = 0; i < 10; i++) {
      const { code } = await createTherapyInvite(prisma, 100n);
      expect(code).toMatch(new RegExp(`^[0-9A-F]{${INVITE_CODE_LENGTH}}$`));
    }
    // Клиент вводит код так, как его увидел (строчными, с пробелами по краям).
    const { code } = await createTherapyInvite(prisma, 100n);
    await expect(
      joinTherapyAsClient(prisma, 555n, `  ${code.toLowerCase()} `),
    ).resolves.toBe(true);
  });
});
