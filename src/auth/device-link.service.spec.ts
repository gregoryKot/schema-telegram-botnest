// Привязка аккаунта мессенджера к существующему (RFC 8628).
//
// Главное, что здесь держится тестами:
//   1. связка целиком — начал в мини-аппе, подтвердил в браузере, забрал
//      сессию ЦЕЛЕВОГО аккаунта (правило про read-after-write: писать и читать
//      в разных местах — там и живут баги);
//   2. порядок в approve — хозяин строки меняется ДО merge, иначе merge унесёт
//      её вместе с исчезающим аккаунтом и мини-апп останется ни с чем, хотя
//      данные уже переехали;
//   3. одноразовость кода — второй опрос не выдаёт вторую сессию.
import { BadRequestException } from '@nestjs/common';
import { DeviceLinkService } from './device-link.service';
import type { AuthService } from './auth.service';
import type { MergeService } from './merge.service';
import type { SecurityLogService } from './security-log.service';
import type { PrismaService } from '../prisma/prisma.service';

interface Row {
  id: string;
  deviceCodeHash: string;
  userCodeHash: string;
  userId: bigint;
  provider: string;
  expiresAt: Date;
  approvedUserId: bigint | null;
  approvedAt: Date | null;
  consumedAt: Date | null;
}

const MAX_USER = 900_000_000_000_001n;
const WEB_USER = 555n;

function makeDeps() {
  const rows: Row[] = [];
  let seq = 0;
  const providers = [
    {
      userId: MAX_USER,
      provider: 'max',
      providerId: '777',
      displayName: 'Гриша',
    },
  ];

  const match = (r: Row, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([k, v]) =>
      k === 'consumedAt'
        ? r.consumedAt === v
        : (r as never as Record<string, unknown>)[k] === v,
    );

  const prisma = {
    deviceLinkRequest: {
      create: ({
        data,
      }: {
        data: Omit<Row, 'id' | 'approvedUserId' | 'approvedAt' | 'consumedAt'>;
      }) => {
        const row: Row = {
          id: `row-${++seq}`,
          approvedUserId: null,
          approvedAt: null,
          consumedAt: null,
          ...data,
        };
        rows.push(row);
        return Promise.resolve({ ...row });
      },
      // Копия, а не ссылка: настоящая Prisma отдаёт снимок строки, и код не
      // имеет права полагаться на то, что он «доедет» вслед за update.
      findUnique: ({ where }: { where: Record<string, unknown> }) => {
        const row = rows.find((r) => match(r, where));
        return Promise.resolve(row ? { ...row } : null);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Row>;
      }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      },
      updateMany: ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<Row>;
      }) => {
        const hit = rows.filter((r) => match(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return Promise.resolve({ count: hit.length });
      },
      delete: ({ where }: { where: { id: string } }) => {
        const i = rows.findIndex((r) => r.id === where.id);
        if (i >= 0) rows.splice(i, 1);
        return Promise.resolve({});
      },
      deleteMany: ({
        where,
      }: {
        where: { OR: Array<Record<string, unknown>> };
      }) => {
        const now = new Date();
        for (let i = rows.length - 1; i >= 0; i--) {
          const r = rows[i];
          const byUser = where.OR.some(
            (c) => 'userId' in c && c.userId === r.userId,
          );
          const stale =
            where.OR.some((c) => 'expiresAt' in c) && r.expiresAt < now;
          if (byUser || stale) rows.splice(i, 1);
        }
        return Promise.resolve({ count: 0 });
      },
    },
    authProvider: {
      findFirst: ({ where }: { where: { userId: bigint; provider: string } }) =>
        Promise.resolve(
          providers.find(
            (p) => p.userId === where.userId && p.provider === where.provider,
          ) ?? null,
        ),
    },
  } as unknown as PrismaService;

  const issueTokens = jest.fn().mockResolvedValue({
    accessToken: 'access-for-target',
    refreshToken: 'refresh-for-target',
    expiresIn: 900,
  });
  const linkProviderToUser = jest.fn().mockResolvedValue({ ok: true });
  const auth = { issueTokens, linkProviderToUser } as unknown as AuthService;

  const merge = {
    merge: jest.fn().mockResolvedValue(undefined),
    summarize: jest.fn().mockResolvedValue({ Rating: 12 }),
  } as unknown as MergeService;

  const securityLog = { log: jest.fn() } as unknown as SecurityLogService;

  return {
    rows,
    prisma,
    auth,
    merge,
    securityLog,
    service: new DeviceLinkService(prisma, auth, merge, securityLog),
  };
}

describe('start — мини-апп просит привязку', () => {
  it('выдаёт два РАЗНЫХ кода: длинный для опроса и короткий для человека', async () => {
    const { service } = makeDeps();
    const a = await service.start(MAX_USER, 'max');

    expect(a.deviceCode).toHaveLength(64);
    expect(a.userCode).toHaveLength(8);
    expect(a.deviceCode).not.toBe(a.userCode);
    expect(a.expiresIn).toBeGreaterThan(0);
    expect(a.interval).toBeGreaterThan(0);
  });

  it('короткий код без похожих начертаний — его набирают руками', async () => {
    const { service } = makeDeps();
    for (let i = 0; i < 30; i++) {
      const { userCode } = await service.start(MAX_USER, 'max');
      expect(userCode).not.toMatch(/[01OIL]/);
    }
  });

  it('в БД лежат хэши, а не сами коды — строка из дампа не даёт войти', async () => {
    const { service, rows } = makeDeps();
    const { deviceCode, userCode } = await service.start(MAX_USER, 'max');

    const dump = JSON.stringify(rows, (_k, v) =>
      typeof v === 'bigint' ? String(v) : (v as unknown),
    );
    expect(dump).not.toContain(deviceCode);
    expect(dump).not.toContain(userCode);
  });

  it('прежний код того же аккаунта гасится — годным остаётся один', async () => {
    const { service, rows } = makeDeps();
    const first = await service.start(MAX_USER, 'max');
    await service.start(MAX_USER, 'max');

    expect(rows).toHaveLength(1);
    await expect(service.preview(first.userCode, WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('preview — что человек видит до подтверждения', () => {
  it('показывает имя из мессенджера и сводку переезжающих данных', async () => {
    const { service } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');

    const preview = await service.preview(userCode, WEB_USER);
    expect(preview).toEqual({
      provider: 'max',
      displayName: 'Гриша',
      sameAccount: false,
      summary: { Rating: 12 },
    });
  });

  it('код набран строчными и с пробелами — принимается', async () => {
    const { service } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');

    await expect(
      service.preview(` ${userCode.toLowerCase()} `, WEB_USER),
    ).resolves.toMatchObject({ provider: 'max' });
  });

  it('браузер вошёл под тем же аккаунтом — переносить нечего', async () => {
    const { service, merge } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');

    const preview = await service.preview(userCode, MAX_USER);
    expect(preview.sameAccount).toBe(true);
    expect(preview.summary).toEqual({});
    expect(merge.summarize).not.toHaveBeenCalled();
  });

  it('чужой код → отказ, ничего не подсказывая', async () => {
    const { service } = makeDeps();
    await expect(service.preview('QQQQQQQQ', WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('код просрочен → отказ', async () => {
    const { service, rows } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');
    rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.preview(userCode, WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('approve — подтверждение в браузере', () => {
  it('хозяин строки меняется ДО merge, иначе мини-аппу нечего забирать', async () => {
    const { service, merge, rows } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');

    let ownerDuringMerge: bigint | undefined;
    (merge.merge as jest.Mock).mockImplementation(() => {
      ownerDuringMerge = rows[0].userId;
      return Promise.resolve();
    });

    await service.approve(userCode, WEB_USER);

    expect(ownerDuringMerge).toBe(WEB_USER);
    expect(merge.merge).toHaveBeenCalledWith(MAX_USER, WEB_USER);
  });

  it('привязывает провайдера мессенджера к целевому аккаунту и пишет аудит', async () => {
    const { service, auth, securityLog } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');

    await expect(
      service.approve(userCode, WEB_USER, '1.2.3.4'),
    ).resolves.toEqual({
      merged: true,
    });
    expect(auth.linkProviderToUser).toHaveBeenCalledWith(
      WEB_USER,
      'max',
      '777',
    );
    expect(securityLog.log).toHaveBeenCalledWith(
      'merge_confirmed',
      expect.objectContaining({
        target: WEB_USER,
        source: MAX_USER,
        provider: 'max',
      }),
    );
  });

  it('тот же аккаунт — merge не запускается', async () => {
    const { service, merge } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');

    await expect(service.approve(userCode, MAX_USER)).resolves.toEqual({
      merged: false,
    });
    expect(merge.merge).not.toHaveBeenCalled();
  });

  it('merge упал — код уничтожен, повторно подтвердить нечего', async () => {
    const { service, merge, rows } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');
    (merge.merge as jest.Mock).mockRejectedValue(new Error('deadlock'));

    await expect(service.approve(userCode, WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
    expect(rows).toHaveLength(0);
  });

  it('второе подтверждение того же кода — отказ', async () => {
    const { service } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');
    await service.approve(userCode, WEB_USER);

    await expect(service.approve(userCode, WEB_USER)).rejects.toThrow(
      'уже подтверждён',
    );
  });
});

describe('poll — мини-апп забирает сессию', () => {
  it('до подтверждения — ждём', async () => {
    const { service } = makeDeps();
    const { deviceCode } = await service.start(MAX_USER, 'max');

    await expect(service.poll(deviceCode)).resolves.toEqual({
      status: 'pending',
    });
  });

  it('связка целиком: начал в мини-аппе → подтвердил в браузере → получил сессию ЦЕЛЕВОГО аккаунта', async () => {
    const { service, auth } = makeDeps();
    const { deviceCode, userCode } = await service.start(MAX_USER, 'max');

    await service.preview(userCode, WEB_USER);
    await service.approve(userCode, WEB_USER);
    const result = await service.poll(deviceCode, '1.2.3.4', 'MAX/26');

    expect(result).toEqual({
      status: 'linked',
      tokens: expect.objectContaining({ accessToken: 'access-for-target' }),
    });
    expect(auth.issueTokens).toHaveBeenCalledWith(
      WEB_USER,
      '1.2.3.4',
      'MAX/26',
    );
  });

  it('код одноразовый: второй опрос второй сессии не даёт', async () => {
    const { service, auth } = makeDeps();
    const { deviceCode, userCode } = await service.start(MAX_USER, 'max');
    await service.approve(userCode, WEB_USER);

    await service.poll(deviceCode);
    await expect(service.poll(deviceCode)).resolves.toEqual({
      status: 'expired',
    });
    expect(auth.issueTokens).toHaveBeenCalledTimes(1);
  });

  it('короткий код в опрос не годится — опрашивают только длинным', async () => {
    const { service } = makeDeps();
    const { userCode } = await service.start(MAX_USER, 'max');

    await expect(service.poll(userCode)).resolves.toEqual({
      status: 'expired',
    });
  });

  it('просроченный код сессии не выдаёт, даже если подтверждён', async () => {
    const { service, rows, auth } = makeDeps();
    const { deviceCode, userCode } = await service.start(MAX_USER, 'max');
    await service.approve(userCode, WEB_USER);
    rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(service.poll(deviceCode)).resolves.toEqual({
      status: 'expired',
    });
    expect(auth.issueTokens).not.toHaveBeenCalled();
  });
});
