// Аудит 2026-10 («Долг с механизмом»): ручки с кодом человека, TOTP и заявками
// считали попытки в памяти процесса — деплой обнулял окно, второй инстанс вёл
// свой счётчик. Тест идёт по настоящим контроллерам, а не по классу-двойнику:
// метка и лимиты читаются с реальных хендлеров тем же Reflector, что и в guard.
// AuthProviderRegistry (DI-тип конструктора контроллера) тянет GoogleProvider, а
// тот — чистый ESM-пакет 'jose', который ts-jest не парсит. Провайдер тут не
// нужен (читаются только метаданные декораторов), поэтому подмена — как в
// auth-account.controller.spec.ts.
jest.mock('../auth/providers/google.provider', () => ({
  GoogleProvider: class {},
}));

import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERSISTENT_THROTTLE_KEY } from './persistent-throttle.decorator';
import { UserThrottlerGuard } from './throttler.guard';
import { PublicEventsController } from './public-events.controller';
import { Auth2faController } from '../auth/auth-2fa.controller';
import { AuthAccountController } from '../auth/auth-account.controller';
import { AuthLoginConfirmController } from '../auth/auth-login-confirm.controller';
import { AuthTicketController } from '../auth/auth-ticket.controller';
import { TherapyConnectionController } from '../therapy/therapy-connection.controller';

type Handler = (...args: never[]) => unknown;
const reflector = new Reflector();

const persistent = (cls: object, handler: Handler): boolean | undefined =>
  reflector.getAllAndOverride<boolean>(PERSISTENT_THROTTLE_KEY, [
    handler,
    cls as never,
  ]);

const limit = (handler: Handler, name: 'short' | 'long'): unknown =>
  Reflect.getMetadata(`THROTTLER:LIMIT${name}`, handler);
const ttl = (handler: Handler, name: 'short' | 'long'): unknown =>
  Reflect.getMetadata(`THROTTLER:TTL${name}`, handler);

type Route = [string, object, Handler, number, number];
const DB_ROUTES: Route[] = [
  [
    'POST /api/auth/merge',
    AuthAccountController,
    AuthAccountController.prototype.confirmMerge,
    3,
    10,
  ],
  [
    'POST /api/auth/email/link',
    AuthAccountController,
    AuthAccountController.prototype.emailLoginLink,
    3,
    10,
  ],
  [
    'POST /api/auth/email/link-to-account',
    AuthAccountController,
    AuthAccountController.prototype.emailLinkToAccount,
    3,
    10,
  ],
  [
    'POST /api/auth/ticket/preview',
    AuthTicketController,
    AuthTicketController.prototype.preview,
    10,
    60,
  ],
  [
    'POST /api/auth/ticket/approve',
    AuthTicketController,
    AuthTicketController.prototype.approve,
    5,
    20,
  ],
  [
    'POST /api/auth/ticket/confirm-login',
    AuthLoginConfirmController,
    AuthLoginConfirmController.prototype.confirmLogin,
    5,
    20,
  ],
  [
    'POST /api/auth/ticket/deny-login',
    AuthLoginConfirmController,
    AuthLoginConfirmController.prototype.denyLogin,
    5,
    20,
  ],
  [
    'POST /api/therapy/request',
    TherapyConnectionController,
    TherapyConnectionController.prototype.submitRequest,
    2,
    5,
  ],
  [
    'POST /api/auth/2fa/enable',
    Auth2faController,
    Auth2faController.prototype.totpEnable,
    5,
    20,
  ],
  [
    'POST /api/auth/2fa/disable',
    Auth2faController,
    Auth2faController.prototype.totpDisable,
    5,
    20,
  ],
  [
    'POST /api/auth/2fa/recovery-codes',
    Auth2faController,
    Auth2faController.prototype.totpRegenerateRecovery,
    5,
    20,
  ],
  [
    'POST /api/auth/2fa/challenge',
    Auth2faController,
    Auth2faController.prototype.totpChallenge,
    5,
    20,
  ],
];

describe('кодовые и заявочные ручки считают попытки в Postgres', () => {
  const guard = new UserThrottlerGuard([], { increment: jest.fn() }, reflector);
  const keyFor = (cls: object, handler: Handler) =>
    (
      guard as unknown as {
        generateKey(c: ExecutionContext, s: string, n: string): string;
      }
    ).generateKey(
      { getHandler: () => handler, getClass: () => cls } as ExecutionContext,
      'ip:127.0.0.1',
      'long',
    );

  it.each(DB_ROUTES)('%s: метка есть, ключ с префиксом db:', (_r, cls, h) => {
    expect(persistent(cls, h)).toBe(true);
    expect(keyFor(cls, h).startsWith('db:')).toBe(true);
  });

  it.each(DB_ROUTES)(
    '%s: метка не съела прежние лимиты',
    (_r, _cls, h, short, long) => {
      // Составной декоратор — это Throttle + метка; потерять лимит при
      // переезде на него значило бы снять защиту, поставив «защиту».
      expect(limit(h, 'short')).toBe(short);
      expect(ttl(h, 'short')).toBe(60_000);
      expect(limit(h, 'long')).toBe(long);
    },
  );

  it('контроль: ручки, оставленные в памяти осознанно, без метки и без db:', () => {
    const memory: [object, Handler][] = [
      [PublicEventsController, PublicEventsController.prototype.track],
      [AuthTicketController, AuthTicketController.prototype.poll],
      [AuthTicketController, AuthTicketController.prototype.start],
      [AuthAccountController, AuthAccountController.prototype.emailConsume],
    ];
    for (const [cls, h] of memory) {
      expect(persistent(cls, h)).toBeUndefined();
      expect(keyFor(cls, h).startsWith('db:')).toBe(false);
    }
  });
});
