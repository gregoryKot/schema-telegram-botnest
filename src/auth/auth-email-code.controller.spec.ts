// HTTP-слой привязки почты кодом: CSRF, чья сессия, след в аудите и уведомление.
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { AuthEmailCodeController } from './auth-email-code.controller';
import type { EmailLinkCodeService } from './email-link-code.service';
import { JwtAuthGuard } from './jwt.guard';
import type { SecurityLogService } from './security-log.service';
import type { SecurityNoticeService } from './security-notice.service';

function makeReq(headers: Record<string, string>): Request {
  return {
    ip: '1.2.3.4',
    headers,
    webUser: { userId: 555n },
  } as unknown as Request;
}

function makeCtl() {
  const codes = { confirm: jest.fn().mockResolvedValue(undefined) };
  const securityLog = { log: jest.fn() };
  const notice = { linked: jest.fn() };
  const ctl = new AuthEmailCodeController(
    codes as unknown as EmailLinkCodeService,
    securityLog as unknown as SecurityLogService,
    notice as unknown as SecurityNoticeService,
  );
  return { ctl, codes, securityLog, notice };
}

describe('POST email/link-code', () => {
  it('ручка под JwtAuthGuard: без сессии привязывать не к чему', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        AuthEmailCodeController.prototype.confirm,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  it('без CSRF-заголовка — отказ, код не проверяется', async () => {
    const { ctl, codes } = makeCtl();
    await expect(
      ctl.confirm({ code: 'K7M2QX94' }, makeReq({})),
    ).rejects.toThrow('Missing CSRF header');
    expect(codes.confirm).not.toHaveBeenCalled();
  });

  it('код проверяется для аккаунта сессии; успех — аудит и уведомление', async () => {
    const { ctl, codes, securityLog, notice } = makeCtl();
    const res = await ctl.confirm(
      { code: 'K7M2QX94' },
      makeReq({ 'x-requested-with': 'webapp' }),
    );
    expect(res).toEqual({ linked: true });
    expect(codes.confirm).toHaveBeenCalledWith(555n, 'K7M2QX94');
    expect(securityLog.log).toHaveBeenCalledWith(
      'provider_linked',
      expect.objectContaining({ userId: 555n, provider: 'email' }),
    );
    expect(notice.linked).toHaveBeenCalledWith(555n, 'email');
  });

  it('код не подошёл — ни аудита привязки, ни уведомления', async () => {
    const { ctl, codes, securityLog, notice } = makeCtl();
    codes.confirm.mockRejectedValue(new Error('Код не подошёл или истёк'));
    await expect(
      ctl.confirm(
        { code: 'ZZZZZZZZ' },
        makeReq({ 'x-requested-with': 'webapp' }),
      ),
    ).rejects.toThrow('Код не подошёл');
    expect(securityLog.log).not.toHaveBeenCalledWith(
      'provider_linked',
      expect.anything(),
    );
    expect(notice.linked).not.toHaveBeenCalled();
  });
});
