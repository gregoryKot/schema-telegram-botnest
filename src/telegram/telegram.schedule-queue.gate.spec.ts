// Шлагбаум очереди перед отправкой: пауза, дневной бюджет, тихие часы.
// R5 (аудит 2026-11): pair_activity приходил напарнику на паузе и вторым
// проактивным за день — очередь проверяла только тихие часы. Очередь —
// настоящий NotificationService на фейковой таблице.
import { Logger } from '@nestjs/common';
import { holdBeforeSend } from './telegram.schedule-queue.gate';
import { runProcessQueue } from './telegram.schedule-queue';
import { NotificationService } from '../notification/notification.service';
import type { SendSettings } from '../bot/account.service';
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';

const NOW = new Date('2026-07-16T12:00:00+03:00'); // день по Москве
const at = (iso: string) => new Date(iso);

const settings = (over: Partial<SendSettings> = {}): SendSettings => ({
  tz: 'Europe/Moscow',
  start: 22,
  end: 8,
  form: 'ty',
  chatId: 1n,
  pausedUntil: null,
  ...over,
});

function queue(rows: Array<[string, string, string | null]>) {
  const table = createFakeTable(
    rows.map(([type, sendAt, sentAt], i) => ({
      id: i + 1,
      userId: 1n,
      type,
      sendAt: at(sendAt),
      sentAt: sentAt ? at(sentAt) : null,
      cancelledAt: null,
    })),
  );
  const svc = new NotificationService({
    scheduledNotification: table,
  } as never);
  const due = (id: number) => {
    const r = table._rows.find((x) => x.id === id) as Row;
    return {
      id,
      userId: 1n,
      type: r.type as string,
      payload: null,
      sendAt: r.sendAt as Date,
    };
  };
  const cancelled = (id: number) =>
    table._rows.find((x) => x.id === id)?.cancelledAt != null;
  return { svc, due, cancelled, table };
}

describe('holdBeforeSend: пауза (R5)', () => {
  it.each(['pair_activity', 'reminder', 'pre_reminder'])(
    '%s на паузе — снимается и не уходит',
    async (type) => {
      const q = queue([[type, '2026-07-16T09:00:00Z', null]]);
      const paused = settings({ pausedUntil: at('2026-07-20T00:00:00Z') });
      expect(await holdBeforeSend(q.svc, q.due(1), paused, NOW)).toBe(true);
      expect(q.cancelled(1)).toBe(true);
    },
  );

  it('сводка дня на паузе уходит: пауза — про проактивные', async () => {
    const q = queue([['summary', '2026-07-16T09:00:00Z', null]]);
    const paused = settings({ pausedUntil: at('2026-07-20T00:00:00Z') });
    expect(await holdBeforeSend(q.svc, q.due(1), paused, NOW)).toBe(false);
    expect(q.cancelled(1)).toBe(false);
  });

  it('пауза кончилась — pair_activity уходит', async () => {
    const q = queue([['pair_activity', '2026-07-16T09:00:00Z', null]]);
    const over = settings({ pausedUntil: at('2026-07-15T00:00:00Z') });
    expect(await holdBeforeSend(q.svc, q.due(1), over, NOW)).toBe(false);
  });
});

describe('holdBeforeSend: дневной бюджет (R5)', () => {
  it('сегодня уже ушло напоминание — pair_activity снимается', async () => {
    const q = queue([
      ['reminder', '2026-07-16T06:00:00Z', '2026-07-16T06:00:00Z'],
      ['pair_activity', '2026-07-16T09:00:00Z', null],
    ]);
    expect(await holdBeforeSend(q.svc, q.due(2), settings(), NOW)).toBe(true);
    expect(q.cancelled(2)).toBe(true);
  });

  it('напоминание вчера — день свободен, pair_activity уходит', async () => {
    const q = queue([
      ['reminder', '2026-07-15T18:00:00Z', '2026-07-15T18:00:00Z'],
      ['pair_activity', '2026-07-16T09:00:00Z', null],
    ]);
    expect(await holdBeforeSend(q.svc, q.due(2), settings(), NOW)).toBe(false);
  });

  it('отложенное с ночи парное утром уступает напоминанию этого дня', async () => {
    const q = queue([
      ['pair_activity', '2026-07-16T05:00:00Z', null], // перенесено к 08:00
      ['reminder', '2026-07-16T18:00:00Z', null], // 21:00 того же дня
    ]);
    expect(await holdBeforeSend(q.svc, q.due(1), settings(), NOW)).toBe(true);
    expect(q.cancelled(2)).toBe(false);
  });

  it('«напомню через час» после напоминания уходит: бюджет — только для парного', async () => {
    const q = queue([
      ['reminder', '2026-07-16T06:00:00Z', '2026-07-16T06:00:00Z'],
      ['pre_reminder', '2026-07-16T07:00:00Z', null],
    ]);
    expect(await holdBeforeSend(q.svc, q.due(2), settings(), NOW)).toBe(false);
  });
});

describe('holdBeforeSend: тихие часы', () => {
  it('Kolkata, 23:00 — перенос на 08:00 местного, в 08:00 уходит (E12)', async () => {
    const q = queue([['reminder', '2026-07-16T17:30:00Z', null]]);
    const kolkata = settings({ tz: 'Asia/Kolkata' });
    const night = at('2026-07-16T17:30:00Z'); // 23:00 IST
    expect(await holdBeforeSend(q.svc, q.due(1), kolkata, night)).toBe(true);
    const deferredTo = q.table._rows[0].sendAt as Date;
    expect(deferredTo.toISOString()).toBe('2026-07-17T02:30:00.000Z');
    expect(await holdBeforeSend(q.svc, q.due(1), kolkata, deferredTo)).toBe(
      false,
    );
  });
});

describe('runProcessQueue: pair_activity напарнику на паузе не уходит', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('строка снята, Telegram не вызван', async () => {
    const q = queue([['pair_activity', '2026-07-16T08:00:00Z', null]]);
    const callApi = jest.fn().mockResolvedValue(undefined);
    await runProcessQueue({
      bot: { telegram: { callApi } } as never,
      accountService: {
        getSendSettingsFor: jest
          .fn()
          .mockResolvedValue(
            new Map([
              ['1', settings({ pausedUntil: at('2026-07-20T00:00:00Z') })],
            ]),
          ),
      } as never,
      notificationService: q.svc,
      logger: new Logger('test'),
    });
    expect(callApi).not.toHaveBeenCalled();
    expect(q.cancelled(1)).toBe(true);
  });
});
