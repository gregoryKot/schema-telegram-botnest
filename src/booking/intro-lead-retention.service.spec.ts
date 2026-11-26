// Обезличивание заявок с формы знакомства по сроку: 12 месяцев от createdAt
// (у заявки нет даты консультации). Что уходит в updateMany; что '' в
// шифрованной колонке читается обратно и граница считается СУБД — на живой
// базе (test/intro-lead.e2e-spec.ts).
import { Logger } from '@nestjs/common';
import { IntroLeadRetentionService } from './intro-lead-retention.service';
import { BOOKING_PII_RETENTION_MONTHS } from './booking-retention.service';

const NOW = new Date('2026-10-15T04:47:00.000Z');
const CUTOFF = new Date('2025-10-15T04:47:00.000Z');

function make(opts: { fail?: boolean; count?: number } = {}) {
  const prisma = {
    introLead: {
      updateMany: jest.fn(async () => {
        if (opts.fail) throw new Error('db down');
        return { count: opts.count ?? 2 };
      }),
    },
  };
  return { prisma, service: new IntroLeadRetentionService(prisma as never) };
}

describe('IntroLeadRetentionService.anonymizeOld', () => {
  it('срок заявки равен сроку брони (12 месяцев): политика обещает один срок', () => {
    expect(BOOKING_PII_RETENTION_MONTHS).toBe(12);
  });

  it('updateMany: точное условие (createdAt < год назад, ещё не обезличена) и набор полей', async () => {
    const { prisma, service } = make();
    await expect(service.anonymizeOld(NOW)).resolves.toEqual({ anonymized: 2 });
    expect(prisma.introLead.updateMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: CUTOFF }, anonymizedAt: null },
      data: {
        clientName: '',
        clientContact: '',
        message: null,
        anonymizedAt: NOW,
      },
    });
  });

  it('затираются только clientName, clientContact, message (+ метка): канал, откуда и доставка остаются', async () => {
    const { prisma, service } = make();
    await service.anonymizeOld(NOW);
    const [arg] = prisma.introLead.updateMany.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    expect(Object.keys(arg.data).sort()).toEqual(
      ['anonymizedAt', 'clientContact', 'clientName', 'message'].sort(),
    );
  });

  it('падение БД не бросает наружу: 0 и ошибка в лог', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service } = make({ fail: true });
    await expect(service.anonymizeOld(NOW)).resolves.toEqual({ anonymized: 0 });
    expect(error).toHaveBeenCalledWith(
      'intro lead retention failed',
      expect.any(Error),
    );
    error.mockRestore();
  });
});
