// AuthDeviceLinkController — HTTP-обвязка привязки аккаунта (RFC 8628).
// Логика проверена в device-link.service.spec.ts; здесь то, что живёт только
// на уровне контроллера: чей userId уходит в сервис, CSRF на подтверждении,
// кука сессии при выдаче и молчание при неудаче.
import type { Request, Response } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import { AuthDeviceLinkController } from './auth-device-link.controller';
import type { DeviceLinkService } from './device-link.service';
import type { SecurityLogService } from './security-log.service';
import { CROSS_SITE_COOKIE, REFRESH_COOKIE } from './auth-http.util';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: { 'content-type': 'application/json' },
    ip: '198.51.100.7',
    cookies: {},
    webUser: { userId: 555n },
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response & { cookie: jest.Mock; clearCookie: jest.Mock } {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response & {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };
}

function makeCtl() {
  const deviceLink = {
    start: jest.fn().mockResolvedValue({
      deviceCode: 'd'.repeat(64),
      userCode: 'ABCD2345',
      expiresIn: 300,
      interval: 3,
    }),
    preview: jest.fn().mockResolvedValue({
      provider: 'max',
      displayName: 'Гриша',
      sameAccount: false,
      summary: { Rating: 3 },
    }),
    approve: jest.fn().mockResolvedValue({ merged: true }),
    poll: jest.fn().mockResolvedValue({ status: 'pending' }),
  };
  const securityLog = { log: jest.fn() };
  return {
    deviceLink,
    securityLog,
    ctl: new AuthDeviceLinkController(
      deviceLink as unknown as DeviceLinkService,
      securityLog as unknown as SecurityLogService,
    ),
  };
}

describe('start / preview / approve — работают от userId сессии', () => {
  it('start передаёт в сервис userId ЗАЛОГИНЕННОГО, а не что-то из тела', async () => {
    const { ctl, deviceLink } = makeCtl();
    await ctl.start({ provider: 'max' }, makeReq());

    expect(deviceLink.start).toHaveBeenCalledWith(555n, 'max');
  });

  it('preview спрашивает от имени того, кто открыл браузер', async () => {
    const { ctl, deviceLink } = makeCtl();
    const preview = await ctl.preview({ code: 'ABCD2345' }, makeReq());

    expect(deviceLink.preview).toHaveBeenCalledWith('ABCD2345', 555n);
    expect(preview.displayName).toBe('Гриша');
  });

  it('approve подтверждает на текущего пользователя и отдаёт признак переноса', async () => {
    const { ctl, deviceLink } = makeCtl();
    await expect(ctl.approve({ code: 'ABCD2345' }, makeReq())).resolves.toEqual(
      { merged: true },
    );
    expect(deviceLink.approve).toHaveBeenCalledWith(
      'ABCD2345',
      555n,
      '198.51.100.7',
    );
  });

  it('approve без CSRF-признака — отказ и запись в аудит, сервис не зовётся', async () => {
    const { ctl, deviceLink, securityLog } = makeCtl();
    const req = makeReq({ headers: {} });

    await expect(ctl.approve({ code: 'ABCD2345' }, req)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(deviceLink.approve).not.toHaveBeenCalled();
    expect(securityLog.log).toHaveBeenCalledWith(
      'csrf_blocked',
      expect.objectContaining({ endpoint: 'device-link/approve' }),
    );
  });
});

describe('poll — выдача сессии мини-аппу', () => {
  it('пока не подтверждено — только статус, куки не ставятся', async () => {
    const { ctl } = makeCtl();
    const res = makeRes();

    await expect(
      ctl.poll({ deviceCode: 'd'.repeat(64) }, makeReq(), res),
    ).resolves.toEqual({
      status: 'pending',
    });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('подтверждено — ставит refresh-куку и отдаёт access-токен', async () => {
    const { ctl, deviceLink } = makeCtl();
    deviceLink.poll.mockResolvedValue({
      status: 'linked',
      tokens: { accessToken: 'a1', refreshToken: 'r1', expiresIn: 900 },
    });
    const res = makeRes();

    const out = await ctl.poll({ deviceCode: 'd'.repeat(64) }, makeReq(), res);

    expect(out).toEqual({
      status: 'linked',
      accessToken: 'a1',
      expiresIn: 900,
    });
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'r1',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
  });

  it('сессия жила в чужом iframe (MAX) — кука остаётся кросс-сайтовой', async () => {
    // Иначе привязка «сработала», а через 15 минут сессия молча перестала бы
    // продлеваться — ровно та поломка, из-за которой появился этот признак.
    const { ctl, deviceLink } = makeCtl();
    deviceLink.poll.mockResolvedValue({
      status: 'linked',
      tokens: { accessToken: 'a1', refreshToken: 'r1', expiresIn: 900 },
    });
    const res = makeRes();
    const req = makeReq({
      cookies: { [CROSS_SITE_COOKIE]: '1' },
    } as Partial<Request>);

    await ctl.poll({ deviceCode: 'd'.repeat(64) }, req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'r1',
      expect.objectContaining({ sameSite: 'none' }),
    );
  });

  it('код протух — статус без токенов и без куки', async () => {
    const { ctl, deviceLink } = makeCtl();
    deviceLink.poll.mockResolvedValue({ status: 'expired' });
    const res = makeRes();

    const out = await ctl.poll({ deviceCode: 'd'.repeat(64) }, makeReq(), res);

    expect(out).toEqual({ status: 'expired' });
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
