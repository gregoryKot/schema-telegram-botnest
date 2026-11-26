// Второй фактор на билете: вход на сайт через MAX подтверждают сессией
// мини-приложения, куда входят без кода, — без этой развилки 2FA обходилась.
import { makeDeps, startLogin, TG_USER } from './login-ticket.harness.spec';
import { grantTicketSession } from './ticket-session';

describe('poll при включённой 2FA', () => {
  it('билет подтверждён → вместо сессии вызов второго фактора, сессии нет', async () => {
    const { tickets, auth, totp, report } = makeDeps();
    totp.isEnabled.mockResolvedValue(true);
    const { deviceCode, userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);
    (report.step as jest.Mock).mockClear();

    const result = await tickets.poll(deviceCode, '1.2.3.4', 'UA');

    expect(result).toEqual({
      status: 'totp_required',
      challengeToken: 'challenge-for-target',
    });
    expect(totp.isEnabled).toHaveBeenCalledWith(TG_USER);
    expect(auth.buildTotpChallengeToken).toHaveBeenCalledWith(
      TG_USER,
      '1.2.3.4',
      'UA',
    );
    expect(auth.issueTokens).not.toHaveBeenCalled();
    // «Внутри» человек окажется только после кода — шаг `taken` не пишем.
    expect(report.step).not.toHaveBeenCalled();
  });

  it('вызов выдаётся один раз: повторный опрос — expired, а не второй вызов', async () => {
    const { tickets, auth, totp } = makeDeps();
    totp.isEnabled.mockResolvedValue(true);
    const { deviceCode, userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);

    await tickets.poll(deviceCode);

    expect(await tickets.poll(deviceCode)).toEqual({ status: 'expired' });
    expect(auth.buildTotpChallengeToken).toHaveBeenCalledTimes(1);
  });

  it('2FA выключена → как раньше: сессия сразу', async () => {
    const { tickets, auth } = makeDeps();
    const { deviceCode, userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);

    expect((await tickets.poll(deviceCode)).status).toBe('linked');
    expect(auth.issueTokens).toHaveBeenCalledTimes(1);
    expect(auth.buildTotpChallengeToken).not.toHaveBeenCalled();
  });
});

describe('grantTicketSession — какому билету нужен код', () => {
  const deps = () => {
    const { auth, totp } = makeDeps();
    totp.isEnabled.mockResolvedValue(true);
    return { auth, totp: totp as never };
  };
  const ticket = (intent: string) => ({ userId: TG_USER, intent });

  it('передача сессии из MAX в браузер (handoff) — тоже через код', async () => {
    const d = deps();
    expect((await grantTicketSession(d, ticket('handoff'))).status).toBe(
      'totp_required',
    );
    expect(d.auth.issueTokens).not.toHaveBeenCalled();
  });

  it('привязка (link) кода на опросе не просит: её одобряют за StepUpGuard', async () => {
    const d = deps();
    expect((await grantTicketSession(d, ticket('link'))).status).toBe('linked');
  });
});
