// HTTP-слой handoff: CSRF, источник userId, hostId по умолчанию.
import type { Request } from 'express';
import { AuthTicketHandoffController } from './auth-ticket-handoff.controller';
import type { LoginTicketService } from './login-ticket/login-ticket.service';
import type { SecurityLogService } from './security-log.service';

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1';

function makeReq(headers: Record<string, string>): Request {
  return {
    ip: '1.2.3.4',
    headers: { 'user-agent': UA, ...headers },
    webUser: { userId: 555n },
  } as unknown as Request;
}

function makeCtl() {
  const tickets = {
    handoff: jest
      .fn()
      .mockResolvedValue({ deviceCode: 'd'.repeat(64), expiresIn: 120 }),
  } as unknown as LoginTicketService;
  const securityLog = { log: jest.fn() } as unknown as SecurityLogService;
  return {
    tickets,
    securityLog,
    ctl: new AuthTicketHandoffController(tickets, securityLog),
  };
}

describe('POST ticket/handoff', () => {
  it('без CSRF-заголовка — 401, аудит, билет не выписан', async () => {
    const { ctl, tickets, securityLog } = makeCtl();
    await expect(ctl.handoff({}, makeReq({}))).rejects.toThrow(
      'Missing CSRF header',
    );
    expect(tickets.handoff).not.toHaveBeenCalled();
    expect(securityLog.log).toHaveBeenCalledWith(
      'csrf_blocked',
      expect.objectContaining({ endpoint: 'ticket/handoff' }),
    );
  });

  it('с заголовком — userId из сессии, hostId по умолчанию telegram', async () => {
    const { ctl, tickets } = makeCtl();
    const res = await ctl.handoff(
      {},
      makeReq({ 'x-requested-with': 'miniapp' }),
    );
    expect(res).toEqual({ deviceCode: 'd'.repeat(64), expiresIn: 120 });
    expect(tickets.handoff).toHaveBeenCalledWith({
      userId: 555n,
      hostId: 'telegram',
      deviceLabel: expect.any(String),
    });
  });

  it('hostId из тела прокидывается', async () => {
    const { ctl, tickets } = makeCtl();
    await ctl.handoff(
      { hostId: 'max' },
      makeReq({ 'x-requested-with': 'miniapp' }),
    );
    expect(tickets.handoff).toHaveBeenCalledWith(
      expect.objectContaining({ hostId: 'max' }),
    );
  });
});
