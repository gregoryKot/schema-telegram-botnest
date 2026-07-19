// Magic-link auth (email.service.ts, 214 lines): a forged or replayable link
// is an account takeover. Covers: raw token never persisted (only its
// sha256 hash), expired/used/unknown/wrong-purpose tokens rejected, and the
// enumeration-safe silent-success paths. Email dispatch (Resend HTTP call)
// is mocked at the `send()` boundary — no network I/O.
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { EmailService } from './email.service';

const USER_ID = 42n;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function makeFakePrisma(users: Record<string, Record<string, unknown>> = {}) {
  const userRows = new Map(Object.entries(users));
  const tokenRows: Record<string, unknown>[] = [];
  return {
    userRows,
    tokenRows,
    user: {
      findUnique: jest.fn(({ where }: any) => {
        const row = [...userRows.values()].find((u) =>
          Object.entries(where).every(([k, v]) => u[k] === v),
        );
        return Promise.resolve(row ? { ...row } : null);
      }),
      findFirst: jest.fn(({ where }: any) => {
        const row = [...userRows.values()].find((u) => {
          if (where.recoveryEmail && u.recoveryEmail !== where.recoveryEmail)
            return false;
          if (where.NOT?.id && u.id === where.NOT.id) return false;
          return true;
        });
        return Promise.resolve(row ? { ...row } : null);
      }),
      update: jest.fn(({ where: { id }, data }: any) => {
        const key = id.toString();
        const next = { ...(userRows.get(key) ?? { id }), ...data };
        userRows.set(key, next);
        return Promise.resolve({ ...next });
      }),
    },
    emailToken: {
      create: jest.fn(({ data }: any) => {
        tokenRows.push({ ...data });
        return Promise.resolve({ ...data });
      }),
      findUnique: jest.fn(({ where: { tokenHash } }: any) => {
        const row = tokenRows.find((r) => r.tokenHash === tokenHash);
        return Promise.resolve(row ? { ...row } : null);
      }),
      update: jest.fn(({ where: { id }, data }: any) => {
        const row = tokenRows.find((r) => r.id === id);
        if (!row) throw new Error('token not found (fake prisma)');
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      }),
    },
  };
}

function makeConfig() {
  return { getOrThrow: () => 'https://schemehappens.ru' } as any;
}

// Mocks the email-dispatch boundary and returns the raw token embedded in
// the link that would have been sent — the only place it's ever visible.
function captureRawToken(service: EmailService): { raw: () => string } {
  const spy = jest.spyOn(service as any, 'send').mockResolvedValue(undefined);
  return {
    raw: () => {
      const text = spy.mock.calls.at(-1)?.[2] as string;
      const match = text.match(/token=([^\s&]+)/);
      if (!match) throw new Error('no token in captured link');
      return match[1];
    },
  };
}

describe('EmailService — token storage (raw never persisted)', () => {
  it('sendRecoveryLink stores only the sha256 hash, never the raw token', async () => {
    const prisma = makeFakePrisma({
      [USER_ID.toString()]: {
        id: USER_ID,
        recoveryEmail: 'a@test.com',
        recoveryEmailVerifiedAt: new Date(),
      },
    });
    const service = new EmailService(prisma as never, makeConfig());
    const capture = captureRawToken(service);

    await service.sendRecoveryLink('a@test.com');
    const raw = capture.raw();

    expect(prisma.tokenRows).toHaveLength(1);
    const stored = prisma.tokenRows[0] as any;
    expect(stored.tokenHash).toBe(hashToken(raw));
    expect(Object.values(stored)).not.toContain(raw);
  });

  it('sendVerificationLink stores only the sha256 hash, never the raw token', async () => {
    const prisma = makeFakePrisma({
      [USER_ID.toString()]: { id: USER_ID },
    });
    const service = new EmailService(prisma as never, makeConfig());
    const capture = captureRawToken(service);

    await service.sendVerificationLink(USER_ID, 'new@test.com');
    const raw = capture.raw();

    const stored = prisma.tokenRows[0] as any;
    expect(stored.tokenHash).toBe(hashToken(raw));
    expect(stored.tokenHash).not.toBe(raw);
  });
});

describe('EmailService — enumeration-safe silent success', () => {
  it('sendRecoveryLink for an unknown email → {ok:true}, no token created, no email sent', async () => {
    const prisma = makeFakePrisma();
    const service = new EmailService(prisma as never, makeConfig());
    const sendSpy = jest
      .spyOn(service as any, 'send')
      .mockResolvedValue(undefined);

    await expect(service.sendRecoveryLink('nobody@test.com')).resolves.toEqual({
      ok: true,
    });
    expect(prisma.tokenRows).toHaveLength(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('sendRecoveryLink for an unverified recovery email → {ok:true}, silent', async () => {
    const prisma = makeFakePrisma({
      [USER_ID.toString()]: {
        id: USER_ID,
        recoveryEmail: 'a@test.com',
        recoveryEmailVerifiedAt: null,
      },
    });
    const service = new EmailService(prisma as never, makeConfig());
    const sendSpy = jest
      .spyOn(service as any, 'send')
      .mockResolvedValue(undefined);

    await service.sendRecoveryLink('a@test.com');
    expect(prisma.tokenRows).toHaveLength(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('invalid email format → BadRequestException before touching prisma', async () => {
    const prisma = makeFakePrisma();
    const service = new EmailService(prisma as never, makeConfig());
    await expect(service.sendRecoveryLink('not-an-email')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.tokenRows).toHaveLength(0);
  });

  it('sendVerificationLink for an email already bound to another user → ConflictException', async () => {
    const other = 43n;
    const prisma = makeFakePrisma({
      [USER_ID.toString()]: { id: USER_ID },
      [other.toString()]: { id: other, recoveryEmail: 'taken@test.com' },
    });
    const service = new EmailService(prisma as never, makeConfig());
    await expect(
      service.sendVerificationLink(USER_ID, 'taken@test.com'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.tokenRows).toHaveLength(0);
  });
});

describe('EmailService — consumeToken', () => {
  it('happy path: valid recovery token resolves userId/email and marks the token used', async () => {
    const prisma = makeFakePrisma({
      [USER_ID.toString()]: {
        id: USER_ID,
        recoveryEmail: 'a@test.com',
        recoveryEmailVerifiedAt: new Date(),
      },
    });
    const service = new EmailService(prisma as never, makeConfig());
    const capture = captureRawToken(service);
    await service.sendRecoveryLink('a@test.com');
    const raw = capture.raw();

    const result = await service.consumeToken(raw, 'recovery');
    expect(result).toEqual({ userId: USER_ID, email: 'a@test.com' });
    expect((prisma.tokenRows[0] as any).usedAt).toBeInstanceOf(Date);
  });

  it('verify_email purpose binds the recoveryEmail onto the user record', async () => {
    const prisma = makeFakePrisma({ [USER_ID.toString()]: { id: USER_ID } });
    const service = new EmailService(prisma as never, makeConfig());
    const capture = captureRawToken(service);
    await service.sendVerificationLink(USER_ID, 'new@test.com');
    const raw = capture.raw();

    await service.consumeToken(raw, 'verify_email');
    const user = prisma.userRows.get(USER_ID.toString()) as any;
    expect(user.recoveryEmail).toBe('new@test.com');
    expect(user.recoveryEmailVerifiedAt).toBeInstanceOf(Date);
  });

  it('unknown token → UnauthorizedException', async () => {
    const prisma = makeFakePrisma();
    const service = new EmailService(prisma as never, makeConfig());
    await expect(
      service.consumeToken('does-not-exist', 'recovery'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('expired token → UnauthorizedException, even if otherwise valid', async () => {
    const prisma = makeFakePrisma({ [USER_ID.toString()]: { id: USER_ID } });
    const raw = 'expired-raw-token';
    prisma.tokenRows.push({
      id: 'tok-1',
      userId: USER_ID,
      tokenHash: hashToken(raw),
      email: 'a@test.com',
      purpose: 'recovery',
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    const service = new EmailService(prisma as never, makeConfig());
    await expect(service.consumeToken(raw, 'recovery')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('token is single-use — a second consume of the same raw token is rejected', async () => {
    const prisma = makeFakePrisma({
      [USER_ID.toString()]: {
        id: USER_ID,
        recoveryEmail: 'a@test.com',
        recoveryEmailVerifiedAt: new Date(),
      },
    });
    const service = new EmailService(prisma as never, makeConfig());
    const capture = captureRawToken(service);
    await service.sendRecoveryLink('a@test.com');
    const raw = capture.raw();

    await service.consumeToken(raw, 'recovery');
    await expect(service.consumeToken(raw, 'recovery')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('wrong expectedPurpose → UnauthorizedException (recovery token used at verify_email callback)', async () => {
    const prisma = makeFakePrisma({
      [USER_ID.toString()]: {
        id: USER_ID,
        recoveryEmail: 'a@test.com',
        recoveryEmailVerifiedAt: new Date(),
      },
    });
    const service = new EmailService(prisma as never, makeConfig());
    const capture = captureRawToken(service);
    await service.sendRecoveryLink('a@test.com');
    const raw = capture.raw();

    await expect(service.consumeToken(raw, 'verify_email')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('missing token → BadRequestException without touching prisma', async () => {
    const prisma = makeFakePrisma();
    const service = new EmailService(prisma as never, makeConfig());
    await expect(service.consumeToken('', 'recovery')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.emailToken.findUnique).not.toHaveBeenCalled();
  });
});
