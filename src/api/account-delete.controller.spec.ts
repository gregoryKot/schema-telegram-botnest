// DELETE /api/user — второй фактор перед необратимым удалением (B-13 аудита
// 2026-10). Раньше хватало голого access-токена.
import { ForbiddenException } from '@nestjs/common';
import {
  AccountDeleteController,
  TOTP_REQUIRED,
} from './account-delete.controller';
import type { AccountService } from '../bot/account.service';
import type { TotpService } from '../auth/totp.service';
import type { SecurityLogService } from '../auth/security-log.service';

function setup(totpEnabled: boolean, codeIsValid = false) {
  const accountService = {
    deleteAllUserData: jest.fn().mockResolvedValue(undefined),
  };
  const totp = {
    isEnabled: jest.fn().mockResolvedValue(totpEnabled),
    verifyCode: jest.fn().mockResolvedValue(codeIsValid),
  };
  const securityLog = { log: jest.fn() };
  const controller = new AccountDeleteController(
    accountService as unknown as AccountService,
    totp as unknown as TotpService,
    securityLog as unknown as SecurityLogService,
  );
  const req = (id: bigint) =>
    ({ webUser: { userId: id }, ip: '1.2.3.4' }) as any;
  return { controller, accountService, totp, securityLog, req };
}

async function reasonOf(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ForbiddenException);
    return (e as ForbiddenException).getResponse();
  }
  throw new Error('ожидали 403');
}

describe('AccountDeleteController.deleteUser', () => {
  it('без 2FA код не нужен: удаляет ИМЕННО данные текущего userId и пишет account_deleted', async () => {
    const { controller, accountService, totp, securityLog, req } = setup(false);
    await expect(controller.deleteUser(req(11n), {})).resolves.toEqual({
      ok: true,
    });
    expect(accountService.deleteAllUserData).toHaveBeenCalledWith(11n);
    expect(totp.verifyCode).not.toHaveBeenCalled();
    expect(securityLog.log).toHaveBeenCalledWith('account_deleted', {
      userId: 11n,
      ip: '1.2.3.4',
    });
  });

  it('2FA включена, кода нет → 403 totp_required, ничего не удалено', async () => {
    const { controller, accountService, securityLog, req } = setup(true);
    const body = await reasonOf(controller.deleteUser(req(5n), {}));
    expect(body).toMatchObject({ reason: TOTP_REQUIRED });
    expect(accountService.deleteAllUserData).not.toHaveBeenCalled();
    // Отсутствие кода — не попытка подбора: totp_failed не пишем.
    expect(securityLog.log).not.toHaveBeenCalled();
  });

  it('2FA включена, код неверный → 403 totp_required, totp_failed в логе, ничего не удалено', async () => {
    const { controller, accountService, securityLog, totp, req } = setup(
      true,
      false,
    );
    const body = await reasonOf(
      controller.deleteUser(req(5n), { code: '000000' }),
    );
    expect(body).toMatchObject({ reason: TOTP_REQUIRED });
    expect(totp.verifyCode).toHaveBeenCalledWith(5n, '000000');
    expect(accountService.deleteAllUserData).not.toHaveBeenCalled();
    expect(securityLog.log).toHaveBeenCalledWith('totp_failed', {
      userId: 5n,
      ip: '1.2.3.4',
      route: 'DELETE user',
    });
  });

  it('2FA включена, код верный → удалено', async () => {
    const { controller, accountService, totp, req } = setup(true, true);
    await expect(
      controller.deleteUser(req(5n), { code: '123456' }),
    ).resolves.toEqual({ ok: true });
    expect(totp.verifyCode).toHaveBeenCalledWith(5n, '123456');
    expect(accountService.deleteAllUserData).toHaveBeenCalledWith(5n);
  });
});
