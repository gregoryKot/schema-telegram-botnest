import { ClientBookingMetricsService } from './client-booking-metrics.service';

const NOW = new Date('2026-11-06T12:00:00Z');

function svcWith(rows: unknown[]) {
  const findMany = jest.fn(async () => rows);
  const prisma = { analyticsEvent: { findMany } };
  return { svc: new ClientBookingMetricsService(prisma as any), findMany };
}

describe('ClientBookingMetricsService', () => {
  it('пустая БД — нули и форматтер без мусора', async () => {
    const { svc } = svcWith([]);
    await expect(svc.getMetrics(NOW)).resolves.toEqual({
      opened: 0,
      openedPeople: 0,
      held: 0,
      confirmed: 0,
    });
    await expect(svc.render()).resolves.toContain('Пока никто');
  });

  it('открытия считает по людям; бронь — только со статусом от сервера', async () => {
    const { svc, findMany } = svcWith([
      { name: 'client_booking_opened', userId: 1n, meta: null },
      { name: 'client_booking_opened', userId: 1n, meta: null },
      { name: 'client_booking_opened', userId: 2n, meta: null },
      { name: 'client_booking_created', userId: 1n, meta: { status: 'held' } },
      {
        name: 'client_booking_created',
        userId: 2n,
        meta: { status: 'confirmed' },
      },
      // Подделка с клиента: meta отброшена санитайзером — не считается.
      { name: 'client_booking_created', userId: 3n, meta: null },
      { name: 'client_booking_created', userId: 3n, meta: { status: 'x' } },
    ]);
    await expect(svc.getMetrics(NOW)).resolves.toEqual({
      opened: 3,
      openedPeople: 2,
      held: 1,
      confirmed: 1,
    });
    const where = (findMany.mock.calls[0] as unknown as [{ where: any }])[0]
      .where;
    expect(where.name.in).toEqual([
      'client_booking_opened',
      'client_booking_created',
    ]);
    expect(where.createdAt.gte).toEqual(
      new Date(NOW.getTime() - 30 * 86_400_000),
    );
  });
});
