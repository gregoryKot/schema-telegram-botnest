// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md), п.6: TotpService — 2FA
// поверх Telegram/Google/VK-логина. До этого спека enroll/verify/disable
// не проверялись вообще, а именно здесь живёт «окно» доверия ко времени
// клиента и одноразовость recovery-кодов — баг тут либо пускает чужого,
// либо навсегда запирает владельца аккаунта.
//
// ENCRYPTION_KEY выставляется ДО импорта TotpService: при commonjs-сборке
// (ts-jest) top-level statements выполняются в текстовом порядке файла, а
// не как «hoisted» ESM-импорты, поэтому src/utils/crypto.ts успевает
// прочитать ключ из process.env при первом require. Так секрет реально
// шифруется (не passthrough дев-режима), и мы можем проверить и сам факт
// шифрования, и корректный roundtrip через ту же (некэшированную повторно)
// копию crypto.ts, что использует сервис.
process.env.ENCRYPTION_KEY = 'aa'.repeat(32);
process.env.ENCRYPTION_KEY_OLD = '';

import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { authenticator } from 'otplib';
import { TotpService } from './totp.service';
import { decrypt } from '../utils/crypto';

const USER_ID = 42n;
const FIXED_TIME = new Date('2026-07-16T12:00:00.000Z').getTime();

function makeFakePrisma(seed: Record<string, Record<string, unknown>> = {}) {
  const users = new Map<string, Record<string, unknown>>(Object.entries(seed));
  return {
    users,
    user: {
      findUnique: jest.fn(({ where: { id } }: { where: { id: bigint } }) => {
        const row = users.get(id.toString());
        return Promise.resolve(row ? { ...row } : null);
      }),
      update: jest.fn(
        ({
          where: { id },
          data,
        }: {
          where: { id: bigint };
          data: Record<string, unknown>;
        }) => {
          const key = id.toString();
          const next = { ...(users.get(key) ?? {}), ...data };
          users.set(key, next);
          return Promise.resolve({ ...next });
        },
      ),
    },
  };
}

function extractSecret(otpauthUrl: string): string {
  const secret = new URL(otpauthUrl).searchParams.get('secret');
  if (!secret) throw new Error('otpauth URL без secret');
  return secret;
}

// Проводит юзера через enroll (startSetup+confirmSetup) и возвращает секрет
// + сервис уже во «включённом» состоянии — общая подготовка для тестов
// verify/disable/regenerate.
async function enroll(prisma: ReturnType<typeof makeFakePrisma>) {
  const service = new TotpService(prisma as never);
  const { otpauthUrl } = await service.startSetup(USER_ID, 'user@test');
  const secret = extractSecret(otpauthUrl);
  const code = authenticator.generate(secret);
  const { recoveryCodes } = await service.confirmSetup(USER_ID, code);
  return { service, secret, recoveryCodes };
}

// Мокаем только Date.now (не jest.useFakeTimers): QRCode.toDataURL внутри
// startSetup — настоящая асинхронная работа на реальных таймерах/microtasks,
// а полный fake-timers режим вешает её навечно (ни один pending-таймер не
// продвигается сам по себе). otplib читает время исключительно через
// Date.now(), так что для TOTP-детерминизма этого мока достаточно.
let dateNowSpy: jest.SpiedFunction<typeof Date.now>;

beforeEach(() => {
  dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIME);
});

afterEach(() => {
  dateNowSpy.mockRestore();
});

describe('TotpService — setup', () => {
  it('startSetup шифрует секрет перед записью и не включает 2FA сразу', async () => {
    const prisma = makeFakePrisma();
    const service = new TotpService(prisma as never);
    const { otpauthUrl, qrDataUrl } = await service.startSetup(
      USER_ID,
      'user@test',
    );
    const secret = extractSecret(otpauthUrl);

    const stored = prisma.users.get(USER_ID.toString())!;
    expect(stored.totpEnabledAt).toBeNull();
    expect(stored.totpSecret).not.toBe(secret); // не голый plaintext
    expect(decrypt(stored.totpSecret as string)).toBe(secret); // но расшифровывается обратно
    expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('повторный startSetup при уже включённой 2FA → ConflictException', async () => {
    const prisma = makeFakePrisma({
      [USER_ID.toString()]: { totpEnabledAt: new Date() },
    });
    const service = new TotpService(prisma as never);
    await expect(service.startSetup(USER_ID, 'user@test')).rejects.toThrow(
      ConflictException,
    );
  });

  it('confirmSetup с верным кодом включает 2FA и выдаёт 10 уникальных recovery-кодов', async () => {
    const prisma = makeFakePrisma();
    const { recoveryCodes } = await enroll(prisma);

    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);
    for (const c of recoveryCodes) expect(c).toMatch(/^[0-9a-f]{10}$/);

    const stored = prisma.users.get(USER_ID.toString())!;
    expect(stored.totpEnabledAt).toBeInstanceOf(Date);
  });

  it('confirmSetup с неверным кодом → UnauthorizedException, 2FA не включается', async () => {
    const prisma = makeFakePrisma();
    const service = new TotpService(prisma as never);
    const { otpauthUrl } = await service.startSetup(USER_ID, 'user@test');
    const secret = extractSecret(otpauthUrl);
    const wrong = String(
      (Number(authenticator.generate(secret)) + 1) % 1e6,
    ).padStart(6, '0');

    await expect(service.confirmSetup(USER_ID, wrong)).rejects.toThrow(
      UnauthorizedException,
    );
    // startSetup уже записал totpEnabledAt: null (черновик до подтверждения) —
    // неверный код confirmSetup не должен превратить его в дату.
    expect(prisma.users.get(USER_ID.toString())!.totpEnabledAt).toBeNull();
  });

  it('confirmSetup без предварительного startSetup → BadRequestException', async () => {
    const prisma = makeFakePrisma();
    const service = new TotpService(prisma as never);
    await expect(service.confirmSetup(USER_ID, '123456')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('повторный confirmSetup на уже включённой 2FA → ConflictException', async () => {
    const prisma = makeFakePrisma();
    const { service, secret } = await enroll(prisma);
    const code = authenticator.generate(secret);
    await expect(service.confirmSetup(USER_ID, code)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('TotpService — verifyCode', () => {
  it('верный текущий TOTP-код → true', async () => {
    const prisma = makeFakePrisma();
    const { service, secret } = await enroll(prisma);
    expect(
      await service.verifyCode(USER_ID, authenticator.generate(secret)),
    ).toBe(true);
  });

  it('неверный код (не TOTP и не recovery) → false', async () => {
    const prisma = makeFakePrisma();
    const { service } = await enroll(prisma);
    expect(await service.verifyCode(USER_ID, '000000')).toBe(false);
  });

  it('окно ±1 шаг (30с дрейфа часов клиента) — код с предыдущего шага принят', async () => {
    const prisma = makeFakePrisma();
    const { service, secret } = await enroll(prisma);

    dateNowSpy.mockReturnValue(FIXED_TIME - 30_000);
    const staleStepCode = authenticator.generate(secret);
    dateNowSpy.mockReturnValue(FIXED_TIME);

    expect(await service.verifyCode(USER_ID, staleStepCode)).toBe(true);
  });

  it('код за пределами окна (двух шагов назад) отвергается', async () => {
    const prisma = makeFakePrisma();
    const { service, secret } = await enroll(prisma);

    dateNowSpy.mockReturnValue(FIXED_TIME - 90_000);
    const farCode = authenticator.generate(secret);
    dateNowSpy.mockReturnValue(FIXED_TIME);

    expect(await service.verifyCode(USER_ID, farCode)).toBe(false);
  });

  it('2FA не включена (нет totpEnabledAt) → всегда false, даже если код бы совпал', async () => {
    const prisma = makeFakePrisma();
    const service = new TotpService(prisma as never);
    const { otpauthUrl } = await service.startSetup(USER_ID, 'user@test'); // enabled=null
    const secret = extractSecret(otpauthUrl);
    expect(
      await service.verifyCode(USER_ID, authenticator.generate(secret)),
    ).toBe(false);
  });

  it('recovery-код принимается один раз — повторное использование отвергается (защита от replay)', async () => {
    const prisma = makeFakePrisma();
    const { service, recoveryCodes } = await enroll(prisma);
    const code = recoveryCodes[0];

    expect(await service.verifyCode(USER_ID, code)).toBe(true);
    expect(await service.verifyCode(USER_ID, code)).toBe(false); // повторно — уже потрачен

    const status = await service.getStatus(USER_ID);
    expect(status.recoveryCodesLeft).toBe(9);
  });

  it('recovery-код регистронезависим и с обрезкой пробелов', async () => {
    const prisma = makeFakePrisma();
    const { service, recoveryCodes } = await enroll(prisma);
    const padded = `  ${recoveryCodes[0].toUpperCase()}  `;
    expect(await service.verifyCode(USER_ID, padded)).toBe(true);
  });
});

describe('TotpService — disable', () => {
  it('верный код отключает 2FA и стирает секрет/recovery-коды', async () => {
    const prisma = makeFakePrisma();
    const { service, secret } = await enroll(prisma);
    await service.disable(USER_ID, authenticator.generate(secret));

    const stored = prisma.users.get(USER_ID.toString())!;
    expect(stored.totpSecret).toBeNull();
    expect(stored.totpEnabledAt).toBeNull();
    expect(await service.isEnabled(USER_ID)).toBe(false);
  });

  it('неверный код при disable → UnauthorizedException, 2FA остаётся включённой', async () => {
    const prisma = makeFakePrisma();
    const { service } = await enroll(prisma);
    await expect(service.disable(USER_ID, '000000')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(await service.isEnabled(USER_ID)).toBe(true);
  });
});

describe('TotpService — regenerateRecoveryCodes', () => {
  it('верный код выдаёт новый набор и инвалидирует старые коды', async () => {
    const prisma = makeFakePrisma();
    const { service, recoveryCodes: oldCodes } = await enroll(prisma);

    const { recoveryCodes: newCodes } = await service.regenerateRecoveryCodes(
      USER_ID,
      oldCodes[0],
    );

    expect(newCodes).toHaveLength(10);
    // старый набор целиком заменён — даже неиспользованный старый код мёртв
    expect(await service.verifyCode(USER_ID, oldCodes[1])).toBe(false);
    expect(await service.verifyCode(USER_ID, newCodes[0])).toBe(true);
  });

  it('неверный код при regenerate → UnauthorizedException, старые коды живы', async () => {
    const prisma = makeFakePrisma();
    const { service, recoveryCodes } = await enroll(prisma);
    await expect(
      service.regenerateRecoveryCodes(USER_ID, '000000'),
    ).rejects.toThrow(UnauthorizedException);
    expect(await service.verifyCode(USER_ID, recoveryCodes[0])).toBe(true);
  });
});

describe('TotpService — isEnabled / getStatus', () => {
  it('до enroll: isEnabled=false, getStatus={enabled:false, recoveryCodesLeft:0}', async () => {
    const prisma = makeFakePrisma();
    const service = new TotpService(prisma as never);
    expect(await service.isEnabled(USER_ID)).toBe(false);
    expect(await service.getStatus(USER_ID)).toEqual({
      enabled: false,
      recoveryCodesLeft: 0,
    });
  });

  it('после enroll: isEnabled=true, recoveryCodesLeft=10', async () => {
    const prisma = makeFakePrisma();
    const { service } = await enroll(prisma);
    expect(await service.isEnabled(USER_ID)).toBe(true);
    expect(await service.getStatus(USER_ID)).toEqual({
      enabled: true,
      recoveryCodesLeft: 10,
    });
  });
});
