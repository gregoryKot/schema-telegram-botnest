// Заявка с формы знакомства (POST /api/booking) пишется в БД ДО уведомлений
// (глобальный аудит 2026-10-11: раньше — только fire-and-forget DM и письмо,
// мертвы оба канала — заявка исчезала без следа, ответ всегда ok:true).
// Здесь — порядок вызовов, шифрование, флаги доставки по исходу каждого канала,
// путь «запись упала», повтор недоставленного. Что строка читается из живой
// базы и доставка отмечается — test/intro-lead.e2e-spec.ts.
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { IntroLeadService } from './intro-lead.service';
import { INTRO_LEAD_SCHEMA } from './intro-lead.schema';
import { encryptRecord } from '../utils/crypto';

// В юнит-среде ключа шифрования нет (encrypt отдаёт открытый текст), поэтому
// шифрование подменено маркером «enc:» строго по полям схемы: тест проверяет,
// что сервис зовёт encryptRecord/decryptRecord с INTRO_LEAD_SCHEMA. Настоящий
// AES на живой базе — test/intro-lead.e2e-spec.ts.
jest.mock('../utils/crypto', () => {
  type Schema = { strings?: string[] };
  const mark = (v: unknown, on: boolean) =>
    typeof v !== 'string' || v === ''
      ? v
      : on
        ? `enc:${v}`
        : v.replace(/^enc:/, '');
  const map = (on: boolean) => (d: Record<string, unknown>, s: Schema) => ({
    ...d,
    ...Object.fromEntries((s.strings ?? []).map((k) => [k, mark(d[k], on)])),
  });
  return { encryptRecord: map(true), decryptRecord: map(false) };
});

const NOW = new Date('2026-10-15T12:00:00.000Z');
const MIN = 60_000;

function make(
  opts: {
    tg?: boolean;
    mail?: boolean;
    createFails?: boolean;
    rows?: Record<string, unknown>[];
    lease?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const prisma = {
    introLead: {
      create: jest.fn(async () => {
        calls.push('create');
        if (opts.createFails)
          throw Object.assign(new Error('db down'), { code: 'P1001' });
        return { id: 7 };
      }),
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
  const service = new IntroLeadService(
    prisma as never,
    telegram as never,
    email as never,
    cronLeader as never,
  );
  return { service, prisma, telegram, email, cronLeader, calls };
}

const DTO = {
  name: 'Мария',
  contact: '@maria',
  message: 'Тревога',
  source: '/x',
};

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('IntroLeadService.submit', () => {
  it('запись в БД идёт ДО уведомлений', async () => {
    const { service, calls } = make();
    await expect(service.submit(DTO)).resolves.toEqual({ ok: true });
    expect(calls[0]).toBe('create');
    expect(calls.slice(1).sort()).toEqual(['email', 'tg']);
  });

  it('в БД уходит шифртекст, расшифровка возвращает исходное; канал и source — открыто', async () => {
    const { service, prisma } = make();
    await service.submit({ ...DTO, channel: 'whatsapp' });
    const [{ data }] = prisma.introLead.create.mock.calls[0] as unknown as [
      { data: Record<string, string> },
    ];
    expect(data).toEqual({
      clientName: 'enc:Мария',
      clientContact: 'enc:@maria',
      message: 'enc:Тревога',
      clientChannel: 'whatsapp',
      source: '/x',
    });
  });

  it('оба канала дошли — оба флага доставки проставлены', async () => {
    const { service, prisma } = make();
    await service.submit(DTO);
    const data = prisma.introLead.update.mock.calls.map(
      (c) => (c[0] as { data: object }).data,
    );
    expect(data).toEqual(
      expect.arrayContaining([
        { tgDeliveredAt: expect.any(Date) },
        { emailDeliveredAt: expect.any(Date) },
      ]),
    );
    expect(prisma.introLead.update).toHaveBeenCalledTimes(2);
  });

  it('Telegram отказал, почта дошла — отмечена только почта', async () => {
    const { service, prisma } = make({ tg: false, mail: true });
    await expect(service.submit(DTO)).resolves.toEqual({ ok: true });
    expect(prisma.introLead.update).toHaveBeenCalledTimes(1);
    expect(prisma.introLead.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { emailDeliveredAt: expect.any(Date) },
    });
  });

  it('оба канала мертвы, запись есть — ok:true и ни одного флага (подберёт повтор)', async () => {
    const { service, prisma } = make({ tg: false, mail: false });
    await expect(service.submit(DTO)).resolves.toEqual({ ok: true });
    expect(prisma.introLead.update).not.toHaveBeenCalled();
  });

  it('падение отправки в канал не роняет ответ и не отмечает доставку', async () => {
    const { service, prisma, telegram } = make();
    telegram.notifyAdmin.mockRejectedValueOnce(new Error('boom'));
    await expect(service.submit(DTO)).resolves.toEqual({ ok: true });
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Intro lead notify threw',
      expect.any(Error),
    );
    expect(prisma.introLead.update).toHaveBeenCalledTimes(1);
  });

  it('канал, который висит, не держит ответ дольше потолка', async () => {
    jest.useFakeTimers();
    try {
      const { service, telegram } = make();
      telegram.notifyAdmin.mockImplementation(() => new Promise(() => {}));
      const pending = service.submit(DTO);
      await jest.advanceTimersByTimeAsync(10_001);
      await expect(pending).resolves.toEqual({ ok: true });
    } finally {
      jest.useRealTimers();
    }
  });

  it('пустое имя или контакт — молча ok: ни записи, ни уведомлений', async () => {
    const { service, prisma, telegram, email } = make();
    await expect(service.submit({ name: ' ', contact: '' })).resolves.toEqual({
      ok: true,
    });
    expect(prisma.introLead.create).not.toHaveBeenCalled();
    expect(telegram.notifyAdmin).not.toHaveBeenCalled();
    expect(email.sendAdminNotification).not.toHaveBeenCalled();
  });
});

describe('IntroLeadService.submit — запись в БД упала', () => {
  it('хоть один канал дошёл — ok:true, заявка у админа с пометкой «не сохранилась в базе»', async () => {
    const { service, telegram, email } = make({
      createFails: true,
      tg: false,
      mail: true,
    });
    await expect(service.submit(DTO)).resolves.toEqual({ ok: true });
    expect(telegram.notifyAdmin).toHaveBeenCalledWith(
      expect.stringContaining('Не сохранилась в базе'),
    );
    expect(telegram.notifyAdmin).toHaveBeenCalledWith(
      expect.stringContaining('@maria'),
    );
    expect(email.sendAdminNotification).toHaveBeenCalledWith(
      expect.stringContaining('не сохранилась в базе'),
      expect.stringContaining('@maria'),
    );
  });

  it('ни один канал не дошёл — 503, а не ложный ok:true', async () => {
    const { service } = make({ createFails: true, tg: false, mail: false });
    await expect(service.submit(DTO)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('ошибка логируется стабильным текстом без значений полей (PII)', async () => {
    const { service } = make({ createFails: true });
    await service.submit(DTO);
    const messages = (Logger.prototype.error as jest.Mock).mock.calls.map((c) =>
      String(c[0]),
    );
    expect(messages).toContain(
      'Intro lead create failed, lead alerted: Error P1001',
    );
    expect(messages.join('\n')).not.toContain('maria');
  });
});

describe('IntroLeadService.redeliver', () => {
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
