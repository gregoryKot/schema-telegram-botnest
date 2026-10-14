// Крон-добор эффектов подтверждения (security#21): берёт только зависшие
// CONFIRMED с пустым флагом и будущим началом, под арендой, ошибки — одним
// warn не чаще раза в 30 минут.
import { Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import {
  BookingConfirmRetryService,
  STALLED_AFTER_MIN,
} from './booking-confirm-retry.service';
import { LEASE_WINDOW } from '../infra/cron-leader.service';

const stalled = (id: number) => ({
  id,
  status: BookingStatus.CONFIRMED,
  startsAt: new Date(Date.now() + 5 * 3_600_000),
  durationMin: 50,
  type: 'SESSION_50',
  clientName: 'Мария',
  clientContact: '@maria',
  message: null,
  meetingUrl: null,
  cancelToken: `tok-${id}`,
  confirmEffectsDoneAt: null,
});

function make(rows: unknown[], claim = true) {
  const prisma = { booking: { findMany: jest.fn(async () => rows) } };
  const notify = { onConfirmed: jest.fn(async () => undefined) };
  const claimRun = jest.fn().mockResolvedValue(claim);
  const service = new BookingConfirmRetryService(
    prisma as never,
    notify as never,
    { claimRun } as never,
  );
  return { service, prisma, notify, claimRun };
}

describe('BookingConfirmRetryService.retryStalled', () => {
  afterEach(() => jest.restoreAllMocks());

  it('под арендой: захватывает bookingConfirmRetry с окном «пять минут»', async () => {
    const { service, claimRun } = make([]);
    await service.retryStalled();
    expect(claimRun).toHaveBeenCalledWith(
      'bookingConfirmRetry',
      LEASE_WINDOW.fiveMinutes,
    );
  });

  it('аренду не получил — в базу не ходит', async () => {
    const { service, prisma, notify } = make([stalled(1)], false);
    await service.retryStalled();
    expect(prisma.booking.findMany.mock.calls).toHaveLength(0);
    expect(notify.onConfirmed.mock.calls).toHaveLength(0);
  });

  it('выбирает CONFIRMED с пустым флагом, будущим началом и застоем не меньше порога', async () => {
    const { service, prisma } = make([]);
    const t0 = Date.now();
    await service.retryStalled();
    const args = (
      prisma.booking.findMany.mock.calls as unknown as any[][]
    )[0][0];
    expect(args.where).toMatchObject({
      status: BookingStatus.CONFIRMED,
      confirmEffectsDoneAt: null,
    });
    expect(args.where.startsAt.gt.getTime()).toBeGreaterThanOrEqual(t0);
    const cutoff = args.where.updatedAt.lt.getTime();
    expect(t0 - cutoff).toBeGreaterThanOrEqual(STALLED_AFTER_MIN * 60_000 - 50);
    expect(args.orderBy).toEqual({ startsAt: 'asc' });
  });

  it('доделывает каждую найденную бронь и пишет итог в log', async () => {
    const { service, notify } = make([stalled(1), stalled(2)]);
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    await service.retryStalled();
    const ids = (notify.onConfirmed.mock.calls as unknown as any[][]).map(
      (c) => c[0].id,
    );
    expect(ids).toEqual([1, 2]);
    expect(log).toHaveBeenCalledWith('Booking confirm retry: finished 2');
  });

  it('ошибка одной брони не останавливает остальные; warn один, с id и причиной', async () => {
    const { service, notify } = make([stalled(1), stalled(2)]);
    notify.onConfirmed.mockRejectedValueOnce(new Error('db down'));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await service.retryStalled();

    expect(notify.onConfirmed.mock.calls).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('#1');
    expect(String(warn.mock.calls[0][0])).toContain('db down');
    expect(error).not.toHaveBeenCalled(); // error ушёл бы владельцу DM каждый тик
  });

  it('повторные падения подряд — warn не чаще раза в 30 минут, не спам', async () => {
    const { service, notify } = make([stalled(1)]);
    notify.onConfirmed.mockRejectedValue(new Error('db down'));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await service.retryStalled();
    await service.retryStalled();
    await service.retryStalled();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(notify.onConfirmed.mock.calls).toHaveLength(3); // но добор идёт каждый тик
  });
});
