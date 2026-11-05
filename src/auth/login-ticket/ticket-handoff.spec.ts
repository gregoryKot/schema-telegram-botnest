// Handoff: сессия из мессенджера во внешний браузер (intent: 'handoff').
import { BadRequestException } from '@nestjs/common';
import * as userCode from './ticket-user-code';
import { makeDeps, WEB_USER, TG_USER } from './login-ticket.harness.spec';

const input = { userId: WEB_USER, hostId: 'telegram', deviceLabel: 'iPhone' };

describe('handoff — выписка', () => {
  it('строка сразу подтверждена хозяином, хранит только хеши, браузер заберёт', async () => {
    const { tickets, rows } = makeDeps();
    const res = await tickets.handoff(input);

    expect(res.deviceCode).toMatch(/^[0-9a-f]{64}$/);
    expect(res.expiresIn).toBe(120);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      intent: 'handoff',
      userId: WEB_USER,
      approvedUserId: WEB_USER,
      provider: 'telegram',
      hostId: 'web',
    });
    expect(rows[0].approvedAt).toBeInstanceOf(Date);
    expect(rows[0].deviceCodeHash).toBe(tickets.hash(res.deviceCode));
    expect(Object.values(rows[0])).not.toContain(res.deviceCode);
    const ttl = rows[0].expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(110_000);
    expect(ttl).toBeLessThanOrEqual(120_000);
  });

  it('живая привязка того же пользователя переживает handoff — её подтверждают в браузере прямо сейчас', async () => {
    const { tickets, rows } = makeDeps();
    await tickets.start({
      intent: 'link',
      provider: 'telegram',
      requesterUserId: input.userId,
      hostId: 'telegram',
      deviceLabel: '',
    });
    await tickets.handoff(input);
    expect(rows.map((r) => r.intent).sort()).toEqual(['handoff', 'link']);
  });

  it('новый handoff гасит прежний того же пользователя', async () => {
    const { tickets, rows } = makeDeps();
    const a = await tickets.handoff(input);
    const b = await tickets.handoff(input);
    expect(rows).toHaveLength(1);
    expect(await tickets.poll(a.deviceCode)).toEqual({ status: 'expired' });
    expect((await tickets.poll(b.deviceCode)).status).toBe('linked');
  });
});

describe('handoff — poll', () => {
  it('сразу отдаёт сессию ЭТОГО пользователя, без шагов воронки входа', async () => {
    const { tickets, auth, report } = makeDeps();
    const { deviceCode } = await tickets.handoff(input);

    const res = await tickets.poll(deviceCode, '1.2.3.4', 'UA');

    expect(res.status).toBe('linked');
    expect(auth.issueTokens).toHaveBeenCalledWith(WEB_USER, '1.2.3.4', 'UA');
    expect(report.step).not.toHaveBeenCalled();
  });

  it('одноразовый: второй опрос — expired', async () => {
    const { tickets, auth } = makeDeps();
    const { deviceCode } = await tickets.handoff(input);
    await tickets.poll(deviceCode);
    expect(await tickets.poll(deviceCode)).toEqual({ status: 'expired' });
    expect(auth.issueTokens).toHaveBeenCalledTimes(1);
  });

  it('просроченный — expired, сессии нет', async () => {
    const { tickets, rows, auth } = makeDeps();
    const { deviceCode } = await tickets.handoff(input);
    rows[0].expiresAt = new Date(Date.now() - 1000);
    expect(await tickets.poll(deviceCode)).toEqual({ status: 'expired' });
    expect(auth.issueTokens).not.toHaveBeenCalled();
  });
});

describe('handoff — короткий код никому не годится', () => {
  const CODE = 'ABCDEFGH';
  beforeEach(() => {
    jest.spyOn(userCode, 'newUserCode').mockReturnValue(CODE);
  });
  afterEach(() => jest.restoreAllMocks());

  it('forConfirm — null, без побочных эффектов', async () => {
    const { tickets, report, rows } = makeDeps();
    await tickets.handoff(input);
    expect(await tickets.forConfirm(CODE, TG_USER)).toBeNull();
    expect(report.step).not.toHaveBeenCalled();
    expect(rows[0].shownToTelegramId).toBeNull();
  });

  it('approveLogin чужим — отказ, билет не переписан', async () => {
    const { tickets, rows } = makeDeps();
    await tickets.handoff(input);
    await expect(tickets.approveLogin(CODE, TG_USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rows[0].approvedUserId).toBe(WEB_USER);
  });

  it('привязка (TicketLinkService.approve) — отказ', async () => {
    const { tickets, links, rows } = makeDeps();
    await tickets.handoff(input);
    await expect(links.approve(CODE, TG_USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rows[0].approvedUserId).toBe(WEB_USER);
  });
});
