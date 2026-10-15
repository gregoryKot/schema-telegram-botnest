// Регрессия аудита 2026-10, backend#21: «⏰ Напомню через час» стиралось
// рестартом. onModuleInit безусловно звал «одноразовую» уборку
// cancelAllPreReminders (updateMany по ВСЕМ неотправленным pre_reminder), а
// деплой — это рестарт, 4–6 раз в день. Напоминание не приходило никогда, в
// логе — одна строка «Cancelled 1 legacy…».
//
// Тест на шве: настоящий хендлер snooze_reminder → настоящий NotificationService
// → таблица → ДВА настоящих onModuleInit поверх неё → getDue() через час.
// Метод уборки здесь не мокается (его больше нет): фейк только у таблицы.
import { Logger } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { TelegramService } from './telegram.service';
import { makeFakeBot, runAction } from './telegram.test-helpers.spec';

type Row = {
  id: number;
  userId: bigint;
  type: string;
  sendAt: Date;
  payload: unknown;
  sentAt: Date | null;
  cancelledAt: Date | null;
};

function makeTable() {
  const rows: Row[] = [];
  const match = (r: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      const val = (r as Record<string, unknown>)[k];
      if (v && typeof v === 'object' && 'lte' in v) {
        return (val as Date) <= (v.lte as Date);
      }
      return val === v;
    });
  return {
    rows,
    create: ({ data }: { data: Partial<Row> }) => {
      const row = {
        id: rows.length + 1,
        sentAt: null,
        cancelledAt: null,
        payload: null,
        ...data,
      } as Row;
      rows.push(row);
      return row;
    },
    updateMany: ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Partial<Row>;
    }) => {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    findMany: ({ where }: { where: Record<string, unknown> }) =>
      rows.filter((r) => match(r, where)),
  };
}

/** «Процесс»: новый TelegramService + onModuleInit поверх общей очереди. */
function bootProcess(notifications: NotificationService) {
  const botService = {
    getUserSettings: jest.fn().mockResolvedValue({
      notifyTimezone: 'Europe/Moscow',
      notifyQuietStart: 22,
      notifyQuietEnd: 8,
    }),
  };
  const accountService = {
    canonicalUserId: jest.fn(async (id: number) => BigInt(id)),
  };
  const fakeBot = makeFakeBot();
  fakeBot.bot.launch.mockImplementation(() => new Promise(() => {}));
  const stub = {} as never;
  const service = new TelegramService(
    fakeBot.bot,
    botService as never,
    stub,
    accountService as never,
    stub,
    stub,
    notifications,
    { track: jest.fn() } as never,
    stub,
    stub,
  );
  service.onModuleInit();
  return { service, fakeBot };
}

const flush = () => new Promise((r) => setImmediate(r));

describe('snooze → рестарт: отложенное напоминание переживает деплой', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    delete process.env.BOT_REDIRECT_USERNAME;
    delete process.env.ADMIN_ID;
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('нажал в 14:30 МСК, деплой в 14:45, в 15:31 pre_reminder на месте и due', async () => {
    const table = makeTable();
    const notifications = new NotificationService({
      scheduledNotification: table,
    } as never);
    const first = bootProcess(notifications);
    await flush();

    jest.useFakeTimers({ now: new Date('2026-10-11T11:30:00Z') });
    const ctx = await runAction(first.fakeBot, 'snooze_reminder', {
      from: { id: 42 },
    });
    expect(ctx.editMessageText).toHaveBeenCalledWith('⏰ Напомню в 15:30');

    // Два рестарта подряд: частота деплоев не должна иметь значения.
    jest.setSystemTime(new Date('2026-10-11T11:45:00Z'));
    first.service.onModuleDestroy();
    const second = bootProcess(notifications);
    jest.useRealTimers();
    await flush();
    jest.useFakeTimers({ now: new Date('2026-10-11T11:50:00Z') });
    second.service.onModuleDestroy();
    bootProcess(notifications);
    jest.useRealTimers();
    await flush();

    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({
      type: 'pre_reminder',
      cancelledAt: null,
      sentAt: null,
    });

    jest.useFakeTimers({ now: new Date('2026-10-11T12:31:00Z') });
    const due = await notifications.getDue();
    expect(due.map((d) => d.type)).toEqual(['pre_reminder']);
  });
});
