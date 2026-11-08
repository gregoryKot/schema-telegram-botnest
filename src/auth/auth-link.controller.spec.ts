// AuthLinkController: привязка/отвязка способа входа (вынесено из
// AuthAccountController вместе с тестами). Step-up проверяет StepUpGuard —
// его логика в step-up.spec.ts; здесь — что гард стоит на обеих ручках и что
// после успеха владелец получает уведомление (S12, аудит 2026-11).
jest.mock('./providers/google.provider', () => ({ GoogleProvider: class {} }));

import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { AuthLinkController } from './auth-link.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { MergeService } from './merge.service';
import { AuthProviderRegistry } from './providers/registry';
import type { AuthProviderHandler, ProviderIdentity } from './providers/types';
import { SecurityLogService } from './security-log.service';
import { SecurityNoticeService } from './security-notice.service';
import { StepUpGuard } from './step-up';

function makeReq(userId: bigint): Request {
  return {
    headers: {},
    webUser: { userId },
    ip: '198.51.100.1',
  } as unknown as Request;
}

function makeController(
  handler?: Partial<AuthProviderHandler>,
  list: Array<Partial<AuthProviderHandler>> = [],
) {
  const auth = {
    linkProviderToUser: jest.fn().mockResolvedValue({ ok: true }),
    buildMergeToken: jest.fn().mockReturnValue('merge-tok'),
    unlinkProvider: jest.fn().mockResolvedValue(undefined),
  };
  const providers = {
    get: jest.fn().mockReturnValue(handler),
    list: jest.fn().mockReturnValue(list),
  };
  const merge = {
    summarize: jest.fn().mockResolvedValue({
      counts: { Note: 3, Rating: 12 },
      twoFactorLost: false,
    }),
  };
  const securityLog = { log: jest.fn() };
  const notice = {
    linked: jest.fn(),
    notify: jest.fn(),
    emailAddresses: jest.fn().mockResolvedValue(['old@example.com']),
  };
  const controller = new AuthLinkController(
    auth as unknown as AuthService,
    providers as unknown as AuthProviderRegistry,
    merge as unknown as MergeService,
    securityLog as unknown as SecurityLogService,
    notice as unknown as SecurityNoticeService,
  );
  return { controller, auth, merge, securityLog, notice };
}

const telegram = (identity: ProviderIdentity) => ({
  id: 'telegram',
  displayName: 'Telegram',
  verifyClientData: jest.fn().mockReturnValue(identity),
});

describe('AuthLinkController — step-up на ручках (S12)', () => {
  it.each(['linkProvider', 'unlink'] as const)(
    '%s: JwtAuthGuard, затем StepUpGuard',
    (method) => {
      const guards: unknown[] = Reflect.getMetadata(
        GUARDS_METADATA,
        AuthLinkController.prototype[method],
      );
      expect(guards).toEqual([JwtAuthGuard, StepUpGuard]);
    },
  );
});

describe('AuthLinkController.linkProvider', () => {
  it('провайдер без verifyClientData → BadRequestException, линковка не выполняется', async () => {
    const { controller, auth, notice } = makeController({ id: 'google' });
    await expect(
      controller.linkProvider('google', {}, makeReq(1n)),
    ).rejects.toThrow(BadRequestException);
    expect(auth.linkProviderToUser).not.toHaveBeenCalled();
    expect(notice.linked).not.toHaveBeenCalled();
  });

  it('успешная линковка → { ok: true }, аудит и уведомление владельцу', async () => {
    const h = telegram({ providerId: 'tg-1', displayName: 'Грег' });
    const { controller, auth, securityLog, notice } = makeController(h);
    const body = { hash: 'x' };
    const res = await controller.linkProvider('telegram', body, makeReq(5n));
    expect(h.verifyClientData).toHaveBeenCalledWith(body);
    expect(auth.linkProviderToUser).toHaveBeenCalledWith(
      5n,
      'telegram',
      'tg-1',
      'Грег',
      undefined,
    );
    expect(res).toEqual({ ok: true });
    expect(securityLog.log).toHaveBeenCalledWith('provider_linked', {
      userId: 5n,
      provider: 'telegram',
      ip: '198.51.100.1',
    });
    expect(notice.linked).toHaveBeenCalledWith(5n, 'telegram');
  });

  it('конфликт providerId с другим userId → mergeToken + summary, уведомления нет', async () => {
    const h = telegram({ providerId: 'tg-1' });
    const { controller, auth, merge, notice } = makeController(h);
    auth.linkProviderToUser.mockResolvedValue({
      ok: false,
      conflictUserId: '555',
    });
    const res = await controller.linkProvider('telegram', {}, makeReq(5n));
    expect(auth.buildMergeToken).toHaveBeenCalledWith(
      5n,
      555n,
      'telegram',
      'tg-1',
    );
    expect(merge.summarize).toHaveBeenCalledWith(555n, 5n);
    expect(res).toEqual({
      merge: true,
      mergeToken: 'merge-tok',
      summary: { Note: 3, Rating: 12 },
      twoFactorLost: false,
    });
    expect(notice.linked).not.toHaveBeenCalled();
  });
});

describe('AuthLinkController.unlink', () => {
  it('неизвестный провайдер → BadRequestException, unlinkProvider не вызывается', async () => {
    const { controller, auth } = makeController(undefined, [{ id: 'google' }]);
    await expect(controller.unlink('vk', makeReq(1n))).rejects.toThrow(
      BadRequestException,
    );
    expect(auth.unlinkProvider).not.toHaveBeenCalled();
  });

  it('известный провайдер → отвязывает, аудит provider_unlinked и уведомление', async () => {
    const { controller, auth, securityLog, notice } = makeController(
      undefined,
      [{ id: 'google' }, { id: 'telegram' }],
    );
    const res = await controller.unlink('google', makeReq(7n));
    expect(auth.unlinkProvider).toHaveBeenCalledWith(7n, 'google');
    expect(securityLog.log).toHaveBeenCalledWith('provider_unlinked', {
      userId: 7n,
      provider: 'google',
      ip: '198.51.100.1',
    });
    expect(notice.notify).toHaveBeenCalledWith(
      7n,
      { kind: 'provider_unlinked', provider: 'google' },
      [],
    );
    expect(notice.emailAddresses).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true });
  });

  // Хвост S12 (аудит 2026-11). Почты нет в реестре провайдеров, и
  // `unlink/email` из кабинета отвечал 400 «Unknown provider»; письмо об
  // отвязке уходит и на снятый адрес — его читаем до отвязки.
  it('почта: отвязывается, уведомление уходит и на снятый адрес', async () => {
    const { controller, auth, notice } = makeController(undefined, [
      { id: 'google' },
    ]);
    const order: string[] = [];
    notice.emailAddresses.mockImplementation(async () => {
      order.push('read');
      return ['old@example.com'];
    });
    auth.unlinkProvider.mockImplementation(async () => {
      order.push('unlink');
    });
    const res = await controller.unlink('email', makeReq(7n));
    expect(order).toEqual(['read', 'unlink']);
    expect(auth.unlinkProvider).toHaveBeenCalledWith(7n, 'email');
    expect(notice.notify).toHaveBeenCalledWith(
      7n,
      { kind: 'provider_unlinked', provider: 'email' },
      ['old@example.com'],
    );
    expect(res).toEqual({ ok: true });
  });

  it('отвязка не удалась (последний способ входа) — уведомления нет', async () => {
    const { controller, auth, notice } = makeController(undefined, []);
    auth.unlinkProvider.mockRejectedValue(new Error('last method'));
    await expect(controller.unlink('email', makeReq(7n))).rejects.toThrow(
      'last method',
    );
    expect(notice.notify).not.toHaveBeenCalled();
  });
});
