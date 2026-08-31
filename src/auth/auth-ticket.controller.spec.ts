// HTTP-слой билета: охрана, подпись устройства, кука сессии.
//
// Отдельно от сервиса, потому что здесь ловятся другие ошибки: не «неверная
// логика билета», а «сессия выдана не в тот контейнер» и «привязку разрешили
// без входа».
import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthTicketController } from './auth-ticket.controller';
import type { LoginTicketService } from './login-ticket/login-ticket.service';
import type { TicketLinkService } from './login-ticket/ticket-link.service';
import type { SecurityLogService } from './security-log.service';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile/15E148 Safari/604.1';

function makeReq(over: Partial<Request> = {}): Request {
  return {
    ip: '1.2.3.4',
    headers: { 'user-agent': IPHONE_UA, 'x-requested-with': 'miniapp' },
    cookies: {},
    ...over,
  } as unknown as Request;
}

function makeRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response & { cookie: jest.Mock; clearCookie: jest.Mock };
}

function makeCtl() {
  const tickets = {
    start: jest.fn().mockResolvedValue({
      deviceCode: 'd'.repeat(64),
      userCode: 'K7M2QX94',
      expiresIn: 300,
      interval: 3,
    }),
    poll: jest.fn().mockResolvedValue({ status: 'pending' }),
  } as unknown as LoginTicketService;
  const links = {
    preview: jest.fn().mockResolvedValue({}),
    approve: jest.fn().mockResolvedValue({ merged: true }),
  } as unknown as TicketLinkService;
  const securityLog = { log: jest.fn() } as unknown as SecurityLogService;
  return {
    tickets,
    links,
    securityLog,
    ctl: new AuthTicketController(tickets, links, securityLog),
  };
}

describe('POST ticket/start', () => {
  it('вход без сессии разрешён — ради него механизм и сделан', async () => {
    const { ctl, tickets } = makeCtl();
    const res = await ctl.start(
      { intent: 'login', provider: 'telegram' },
      makeReq(),
    );

    expect(res.userCode).toBe('K7M2QX94');
    expect(tickets.start).toHaveBeenCalledWith({
      intent: 'login',
      provider: 'telegram',
      requesterUserId: null,
      hostId: 'web',
      deviceLabel: 'iPhone · Safari',
    });
  });

  it('привязка без сессии — 401: привязывать не к чему', async () => {
    const { ctl, tickets } = makeCtl();
    await expect(
      ctl.start({ intent: 'link', provider: 'max' }, makeReq()),
    ).rejects.toThrow(UnauthorizedException);
    expect(tickets.start).not.toHaveBeenCalled();
  });

  it('привязка с сессией уходит с хозяином', async () => {
    const { ctl, tickets } = makeCtl();
    await ctl.start(
      { intent: 'link', provider: 'max' },
      makeReq({ webUser: { userId: 555n } } as Partial<Request>),
    );
    expect(tickets.start).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'link', requesterUserId: 555n }),
    );
  });

  it('билет ВХОДА не наследует чужую сессию, даже если она есть', async () => {
    const { ctl, tickets } = makeCtl();
    await ctl.start(
      { intent: 'login', provider: 'google' },
      makeReq({ webUser: { userId: 555n } } as Partial<Request>),
    );
    // Иначе вход «под другим аккаунтом» на общем устройстве молча вернул бы
    // прежнего хозяина.
    expect(tickets.start).toHaveBeenCalledWith(
      expect.objectContaining({ requesterUserId: null }),
    );
  });

  it('hostId берётся из тела, когда контейнер его назвал', async () => {
    const { ctl, tickets } = makeCtl();
    await ctl.start(
      { intent: 'login', provider: 'telegram', hostId: 'max' },
      makeReq(),
    );
    expect(tickets.start).toHaveBeenCalledWith(
      expect.objectContaining({ hostId: 'max' }),
    );
  });
});

describe('POST ticket/approve', () => {
  it('без CSRF-заголовка не подтверждает и пишет в аудит', async () => {
    const { ctl, links, securityLog } = makeCtl();
    const req = makeReq({
      headers: {},
      webUser: { userId: 555n },
    } as Partial<Request>);

    await expect(ctl.approve({ code: 'K7M2QX94' }, req)).rejects.toThrow();
    expect(links.approve).not.toHaveBeenCalled();
    expect(securityLog.log).toHaveBeenCalledWith(
      'csrf_blocked',
      expect.objectContaining({ endpoint: 'ticket/approve' }),
    );
  });

  it('с заголовком — подтверждает от имени вошедшего', async () => {
    const { ctl, links } = makeCtl();
    const req = makeReq({ webUser: { userId: 555n } } as Partial<Request>);

    expect(await ctl.approve({ code: 'K7M2QX94' }, req)).toEqual({
      merged: true,
    });
    expect(links.approve).toHaveBeenCalledWith('K7M2QX94', 555n, '1.2.3.4');
  });
});

describe('POST ticket/poll', () => {
  it('пока не подтвердили — статус без токена и без куки', async () => {
    const { ctl } = makeCtl();
    const res = makeRes();

    expect(
      await ctl.poll({ deviceCode: 'd'.repeat(64) }, makeReq(), res),
    ).toEqual({ status: 'pending' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('отказ доезжает до контейнера как denied, а не как истечение', async () => {
    const { ctl, tickets } = makeCtl();
    (tickets.poll as jest.Mock).mockResolvedValue({ status: 'denied' });

    expect(
      await ctl.poll({ deviceCode: 'd'.repeat(64) }, makeReq(), makeRes()),
    ).toEqual({ status: 'denied' });
  });

  it('подтверждён — refresh-кука ставится ЭТОМУ контейнеру, вместе с access', async () => {
    const { ctl, tickets } = makeCtl();
    (tickets.poll as jest.Mock).mockResolvedValue({
      status: 'linked',
      tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
    });
    const res = makeRes();

    expect(
      await ctl.poll({ deviceCode: 'd'.repeat(64) }, makeReq(), res),
    ).toEqual({ status: 'linked', accessToken: 'a', expiresIn: 900 });
    // Ровно то, ради чего весь механизм: сессия возвращается туда, где вход
    // начался, а не туда, где человек его подтвердил.
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'r',
      expect.objectContaining({ httpOnly: true, secure: true }),
    );
  });
});
