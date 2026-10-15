// Повтор доставки заявок с формы знакомства (правило №17: аренда прогона).
// Выбор строк, счётчик попыток до отправки, пометка повтора, пропуск стёртых.
// Что крон читает настоящую строку живой базы — test/intro-lead.e2e-spec.ts.
import { Logger } from '@nestjs/common';
import { IntroLeadService } from './intro-lead.service';
import { IntroLeadRedeliveryService } from './intro-lead-redelivery.service';
import { INTRO_LEAD_SCHEMA } from './intro-lead.schema';
import { encryptRecord } from '../utils/crypto';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const MIN = 60_000;

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
});
afterEach(() => jest.restoreAllMocks());

function make(
  opts: {
    tg?: boolean;
    mail?: boolean;
    rows?: Record<string, unknown>[];
    lease?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const prisma = {
    introLead: {
      update: jest.fn(async () => ({})),
      findMany: jest.fn(async () => opts.rows ?? []),
    },
  };
  const telegram = {
    notifyAdmin: jest.fn(async () => {
      calls.push('tg');
      return opts.tg ?? true;
    }),
  };
  const email = {
    sendAdminNotification: jest.fn(async () => {
      calls.push('email');
      return opts.mail ?? true;
    }),
  };
  const cronLeader = { claimRun: jest.fn(async () => opts.lease ?? true) };
  const introLead = new IntroLeadService(
    prisma as never,
    telegram as never,
    email as never,
  );
  const service = new IntroLeadRedeliveryService(
    prisma as never,
    cronLeader as never,
    introLead,
  );
  return { service, prisma, telegram, email, cronLeader, calls };
}

describe('IntroLeadRedeliveryService.redeliver', () => {
  const row = (over = {}) => ({
    id: 3,
    ...encryptRecord(
      { clientName: 'Ира', clientContact: '@ira', message: null },
      INTRO_LEAD_SCHEMA,
    ),
    clientChannel: 'telegram',
    source: null,
    ...over,
  });

  it('без аренды ничего не читает и не шлёт', async () => {
    const { service, prisma, telegram } = make({ lease: false });
    await expect(service.redeliver(NOW)).resolves.toBe(0);
    expect(prisma.introLead.findMany).not.toHaveBeenCalled();
    expect(telegram.notifyAdmin).not.toHaveBeenCalled();
  });

  it('берёт только недоставленные, не обезличенные, до 5 попыток, от 5 минут до 7 дней', async () => {
    const { service, prisma, cronLeader } = make();
    await service.redeliver(NOW);
    expect(cronLeader.claimRun).toHaveBeenCalledWith(
      'introLeadRedelivery',
      expect.any(Number),
      NOW,
    );
    expect(prisma.introLead.findMany).toHaveBeenCalledWith({
      where: {
        tgDeliveredAt: null,
        emailDeliveredAt: null,
        anonymizedAt: null,
        deliveryAttempts: { lt: 5 },
        createdAt: {
          gt: new Date(NOW.getTime() - 7 * 86_400_000),
          lt: new Date(NOW.getTime() - 5 * MIN),
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
  });

  it('шлёт расшифрованную заявку с пометкой повтора, считает попытку до отправки, отмечает доставку', async () => {
    const { service, prisma, telegram, calls } = make({
      rows: [row()],
      mail: false,
    });
    await expect(service.redeliver(NOW)).resolves.toBe(1);
    expect(prisma.introLead.update).toHaveBeenNthCalledWith(1, {
      where: { id: 3 },
      data: { deliveryAttempts: { increment: 1 } },
    });
    const text = telegram.notifyAdmin.mock.calls[0] as unknown as [string];
    expect(text[0]).toContain('Повторная отправка');
    expect(text[0]).toContain('Ира');
    expect(text[0]).toContain('@ira');
    expect(prisma.introLead.update).toHaveBeenLastCalledWith({
      where: { id: 3 },
      data: { tgDeliveredAt: expect.any(Date) },
    });
    expect(calls).toEqual(expect.arrayContaining(['tg', 'email']));
  });

  it('строка с пустыми (стёртыми) полями не шлётся', async () => {
    const { service, telegram } = make({
      rows: [row({ clientName: '', clientContact: '' })],
    });
    await expect(service.redeliver(NOW)).resolves.toBe(0);
    expect(telegram.notifyAdmin).not.toHaveBeenCalled();
  });

  it('падение запроса не бросает наружу и логируется', async () => {
    const { service, prisma } = make();
    prisma.introLead.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(service.redeliver(NOW)).resolves.toBe(0);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'intro lead redelivery failed',
      expect.any(Error),
    );
  });
});
