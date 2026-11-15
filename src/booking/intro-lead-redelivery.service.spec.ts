// Повтор доставки заявок с формы знакомства (правило №17: аренда прогона).
// Выбор строк, счётчик попыток до отправки, пометка повтора, пропуск стёртых.
// Что крон читает настоящую строку живой базы — test/intro-lead.e2e-spec.ts.
import { Logger } from '@nestjs/common';
import { IntroLeadService } from './intro-lead.service';
import { IntroLeadRedeliveryService } from './intro-lead-redelivery.service';
import { INTRO_LEAD_SCHEMA } from './intro-lead.schema';
import { TelegramService } from '../telegram/telegram.service';
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
    /** Настоящий TelegramService вместо мока (шов «есть ли канал»). */
    realTelegram?: TelegramService;
  } = {},
) {
  const calls: string[] = [];
  const prisma = {
    introLead: {
      update: jest.fn(async () => ({})),
      findMany: jest.fn(async () => opts.rows ?? []),
    },
  };
  const mockTelegram = {
    canNotifyAdmin: jest.fn(() => true),
    notifyAdmin: jest.fn(async () => {
      calls.push('tg');
      return opts.tg ?? true;
    }),
  };
  const telegram = opts.realTelegram ?? mockTelegram;
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
    telegram as never,
  );
  return { service, prisma, telegram: mockTelegram, email, cronLeader, calls };
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

  it('берёт заявки без доставленного письма, не обезличенные, до 5 попыток, от 5 минут до 7 дней', async () => {
    const { service, prisma, cronLeader } = make();
    await service.redeliver(NOW);
    expect(cronLeader.claimRun).toHaveBeenCalledWith(
      'introLeadRedelivery',
      expect.any(Number),
      NOW,
    );
    expect(prisma.introLead.findMany).toHaveBeenCalledWith({
      where: {
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
    const { service, prisma, telegram, email, calls } = make({
      rows: [row({ tgDeliveredAt: null })],
      mail: false,
    });
    await expect(service.redeliver(NOW)).resolves.toBe(1);
    expect(prisma.introLead.update).toHaveBeenNthCalledWith(1, {
      where: { id: 3 },
      data: { deliveryAttempts: { increment: 1 } },
    });
    const text = telegram.notifyAdmin.mock.calls[0] as unknown as [string];
    expect(text[0]).toContain('Повторная отправка');
    expect(text[0]).toContain('#3');
    expect(text[0]).not.toContain('Ира'); // имя и контакт — только в письме
    expect(text[0]).not.toContain('@ira');
    expect(email.sendAdminNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('@ira'),
    );
    expect(prisma.introLead.update).toHaveBeenLastCalledWith({
      where: { id: 3 },
      data: { tgDeliveredAt: expect.any(Date) },
    });
    expect(calls).toEqual(expect.arrayContaining(['tg', 'email']));
  });

  // Данные человека несёт только письмо: DM дошёл, письмо нет — досылаем
  // письмо, а второй DM «первая не дошла» не шлём.
  it('DM уже дошёл, письмо нет — повтор только письмом', async () => {
    const { service, telegram, email } = make({
      rows: [row({ tgDeliveredAt: new Date(NOW.getTime() - 10 * MIN) })],
    });
    await expect(service.redeliver(NOW)).resolves.toBe(1);
    expect(telegram.notifyAdmin).not.toHaveBeenCalled();
    expect(email.sendAdminNotification).toHaveBeenCalledTimes(1);
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

  // Канал (бот и ADMIN_ID) спрашивается у настоящего TelegramService: без него
  // notifyAdmin отвечает false так же, как на сбой Telegram.
  describe('канал к владельцу — настоящий TelegramService', () => {
    const OLD_ADMIN_ID = process.env.ADMIN_ID;
    afterEach(() => {
      if (OLD_ADMIN_ID === undefined) delete process.env.ADMIN_ID;
      else process.env.ADMIN_ID = OLD_ADMIN_ID;
    });
    const telegramWith = (sendMessage: (() => Promise<unknown>) | null) => {
      const bot = sendMessage ? { telegram: { sendMessage } } : null;
      const n = null as never; // сервисы хендлеров бота: notifyAdmin их не трогает
      return new TelegramService(bot as never, n, n, n, n, n, n, n, n);
    };
    const spent = {
      where: { id: 3 },
      data: { deliveryAttempts: { increment: 1 } },
    };

    it('ADMIN_ID не задан: заявка без DM ждёт — попытка не списана, ничего не шлётся', async () => {
      delete process.env.ADMIN_ID;
      const sendMessage = jest.fn(async () => ({}));
      const { service, prisma, email } = make({
        rows: [row({ tgDeliveredAt: null })],
        realTelegram: telegramWith(sendMessage),
      });
      await expect(service.redeliver(NOW)).resolves.toBe(0);
      expect(prisma.introLead.update).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
      expect(email.sendAdminNotification).not.toHaveBeenCalled();
    });

    it('бота нет: попытка не списана', async () => {
      process.env.ADMIN_ID = '999';
      const { service, prisma } = make({
        rows: [row({ tgDeliveredAt: null })],
        realTelegram: telegramWith(null),
      });
      await expect(service.redeliver(NOW)).resolves.toBe(0);
      expect(prisma.introLead.update).not.toHaveBeenCalled();
    });

    it('канала нет, а DM уже дошёл: письмо повторяется, попытка списана', async () => {
      delete process.env.ADMIN_ID;
      const { service, prisma, email } = make({
        rows: [row({ tgDeliveredAt: new Date(NOW.getTime() - 10 * MIN) })],
        realTelegram: telegramWith(null),
      });
      await expect(service.redeliver(NOW)).resolves.toBe(1);
      expect(prisma.introLead.update).toHaveBeenNthCalledWith(1, spent);
      expect(email.sendAdminNotification).toHaveBeenCalledTimes(1);
    });

    it('канал есть, Telegram упал: попытка списана, DM не отмечен доставленным', async () => {
      process.env.ADMIN_ID = '999';
      const sendMessage = jest.fn(async () => {
        throw new Error('blocked');
      });
      const { service, prisma } = make({
        rows: [row({ tgDeliveredAt: null })],
        realTelegram: telegramWith(sendMessage),
      });
      await expect(service.redeliver(NOW)).resolves.toBe(1);
      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(prisma.introLead.update).toHaveBeenNthCalledWith(1, spent);
      expect(prisma.introLead.update).not.toHaveBeenCalledWith({
        where: { id: 3 },
        data: { tgDeliveredAt: expect.any(Date) },
      });
    });
  });
});
