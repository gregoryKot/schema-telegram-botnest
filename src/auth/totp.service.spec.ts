import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import { TotpService } from './totp.service';

// Воспроизводим приватный hashCode из сервиса (sha256 от trim+lowercase).
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

describe('TotpService', () => {
  // Детерминизм: TOTP-коды привязаны к 30-сек окну реального времени. Без фикса
  // под нагрузкой полного прогона generate и check могут попасть в разные окна → флак.
  // Закрепляем epoch у otplib-синглтона (его же использует сервис) — НЕ через fake
  // timers, иначе зависает QRCode.toDataURL. Тест и сервис видят один шаг времени.
  beforeEach(() => {
    authenticator.options = { window: 1, epoch: 1_750_000_000_000 };
  });
  afterEach(() => {
    authenticator.options = { window: 1 };
  });

  describe('startSetup', () => {
    it('генерирует секрет, otpauth-URL и QR; secret ещё не подтверждён', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: null });
      const svc = new TotpService(prisma);

      const res = await svc.startSetup(1n, 'user@mail');
      expect(res.otpauthUrl).toContain('otpauth://');
      expect(res.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      // сохранён secret, но totpEnabledAt = null (не активирован)
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ totpEnabledAt: null }),
      }));
    });

    it('кидает Conflict, если 2FA уже включён', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: new Date() });
      await expect(new TotpService(prisma).startSetup(1n, 'x')).rejects.toThrow(ConflictException);
    });
  });

  describe('confirmSetup', () => {
    const secret = authenticator.generateSecret();

    it('верный код активирует 2FA и возвращает 10 recovery-кодов', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpSecret: secret, totpEnabledAt: null });
      const svc = new TotpService(prisma);

      const code = authenticator.generate(secret);
      const { recoveryCodes } = await svc.confirmSetup(1n, code);
      expect(recoveryCodes).toHaveLength(10);
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ totpEnabledAt: expect.any(Date) }),
      }));
    });

    it('кидает BadRequest, если setup не начат (нет секрета)', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpSecret: null, totpEnabledAt: null });
      await expect(new TotpService(prisma).confirmSetup(1n, '123456')).rejects.toThrow(BadRequestException);
    });

    it('кидает Conflict, если 2FA уже включён', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpSecret: secret, totpEnabledAt: new Date() });
      await expect(new TotpService(prisma).confirmSetup(1n, '123456')).rejects.toThrow(ConflictException);
    });

    it('кидает Unauthorized на неверный код', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpSecret: secret, totpEnabledAt: null });
      await expect(new TotpService(prisma).confirmSetup(1n, '000000')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyCode', () => {
    const secret = authenticator.generateSecret();

    it('false, если 2FA не включён', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: null, totpSecret: null });
      expect(await new TotpService(prisma).verifyCode(1n, '123456')).toBe(false);
    });

    it('true на валидный TOTP-код (recovery не трогается)', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        totpEnabledAt: new Date(), totpSecret: secret, totpRecoveryCodes: JSON.stringify([]),
      });
      const svc = new TotpService(prisma);
      expect(await svc.verifyCode(1n, authenticator.generate(secret))).toBe(true);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('валидный recovery-код срабатывает и расходуется (удаляется из списка)', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        totpEnabledAt: new Date(),
        totpSecret: secret,
        totpRecoveryCodes: JSON.stringify([hashCode('abcdef0123'), hashCode('ffffffffff')]),
      });
      const svc = new TotpService(prisma);
      expect(await svc.verifyCode(1n, 'abcdef0123')).toBe(true);
      // код израсходован → update с оставшимся одним хэшем
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it('recovery-коды в legacy-форме (массив, не строка) тоже срабатывают', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        totpEnabledAt: new Date(),
        totpSecret: secret,
        totpRecoveryCodes: [hashCode('legacy0001'), hashCode('legacy0002')], // массив
      });
      expect(await new TotpService(prisma).verifyCode(1n, 'legacy0001')).toBe(true);
    });

    it('false на неверный код (ни TOTP, ни recovery)', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        totpEnabledAt: new Date(), totpSecret: secret, totpRecoveryCodes: JSON.stringify([hashCode('zzz')]),
      });
      expect(await new TotpService(prisma).verifyCode(1n, 'nope999999')).toBe(false);
    });
  });

  describe('disable', () => {
    const secret = authenticator.generateSecret();

    it('очищает поля 2FA после верного кода', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        totpEnabledAt: new Date(), totpSecret: secret, totpRecoveryCodes: JSON.stringify([]),
      });
      const svc = new TotpService(prisma);
      await svc.disable(1n, authenticator.generate(secret));
      expect(prisma.user.update).toHaveBeenLastCalledWith(expect.objectContaining({
        data: { totpSecret: null, totpEnabledAt: null, totpRecoveryCodes: [] },
      }));
    });

    it('кидает Unauthorized на неверный код', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: new Date(), totpSecret: secret, totpRecoveryCodes: JSON.stringify([]) });
      await expect(new TotpService(prisma).disable(1n, '000000')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('regenerateRecoveryCodes', () => {
    const secret = authenticator.generateSecret();

    it('верный код → новые 10 кодов', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: new Date(), totpSecret: secret, totpRecoveryCodes: JSON.stringify([]) });
      const svc = new TotpService(prisma);
      const { recoveryCodes } = await svc.regenerateRecoveryCodes(1n, authenticator.generate(secret));
      expect(recoveryCodes).toHaveLength(10);
    });

    it('неверный код → Unauthorized', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: new Date(), totpSecret: secret, totpRecoveryCodes: JSON.stringify([]) });
      await expect(new TotpService(prisma).regenerateRecoveryCodes(1n, '000000')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('isEnabled / getStatus', () => {
    it('isEnabled отражает totpEnabledAt', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: new Date() });
      expect(await new TotpService(prisma).isEnabled(1n)).toBe(true);
      prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: null });
      expect(await new TotpService(prisma).isEnabled(1n)).toBe(false);
    });

    it('getStatus: выключен → enabled:false, 0 кодов', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({ totpEnabledAt: null });
      expect(await new TotpService(prisma).getStatus(1n)).toEqual({ enabled: false, recoveryCodesLeft: 0 });
    });

    it('getStatus: включён → считает оставшиеся recovery-коды', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        totpEnabledAt: new Date(), totpRecoveryCodes: JSON.stringify([hashCode('a'), hashCode('b'), hashCode('c')]),
      });
      expect(await new TotpService(prisma).getStatus(1n)).toEqual({ enabled: true, recoveryCodesLeft: 3 });
    });

    it('getStatus: recovery-коды в legacy-форме (массив) тоже считаются', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        totpEnabledAt: new Date(), totpRecoveryCodes: [hashCode('a'), hashCode('b')],
      });
      expect(await new TotpService(prisma).getStatus(1n)).toEqual({ enabled: true, recoveryCodesLeft: 2 });
    });
  });
});
