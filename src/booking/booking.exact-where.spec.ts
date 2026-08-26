// Точечное усиление против выживших ObjectLiteral-мутантов booking.service.ts:
// prisma.booking.findUnique должен реально уходить с конкретным where —
// {} прошёл бы незамеченным через фейки, которые игнорируют аргументы.
import { BookingStatus } from '@prisma/client';
import { BookingService } from './booking.service';
import { assertWithinAvailability } from './booking.availability';

function makeService(row: any) {
  const prisma: any = {
    booking: { findUnique: jest.fn(async () => row) },
  };
  const service = new BookingService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { get: () => undefined } as any,
  );
  return { service, prisma };
}

describe('BookingService — findUnique уходит с конкретным where (не пустой объект)', () => {
  it('cancel: findUnique вызван с where:{cancelToken}', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.cancel('tok-abc')).rejects.toThrow();
    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { cancelToken: 'tok-abc' },
    });
  });

  it('getById: findUnique вызван с where:{id}', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.getById(42)).rejects.toThrow();
    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
    });
  });

  it('getPublicByToken: findUnique вызван с where:{cancelToken}', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.getPublicByToken('tok-xyz')).rejects.toThrow();
    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { cancelToken: 'tok-xyz' },
    });
  });
});

describe('BookingService.cancel — точное сообщение для COMPLETED', () => {
  it('COMPLETED-бронь: сообщение ИМЕННО "Cannot cancel completed session"', async () => {
    const { service } = makeService({
      id: 1,
      status: BookingStatus.COMPLETED,
    });
    await expect(service.cancel('tok')).rejects.toThrow(
      'Cannot cancel completed session',
    );
  });
});

describe('BookingService.assertWithinAvailability — сообщение точной длительности', () => {
  it('длительность вне диапазона 15-180 — сообщение ИМЕННО "Invalid duration"', async () => {
    const prisma: any = { availabilityRule: { findMany: jest.fn() } };
    await expect(
      assertWithinAvailability(prisma, new Date(), 5),
    ).rejects.toThrow('Invalid duration');
    expect(prisma.availabilityRule.findMany).not.toHaveBeenCalled();
  });
});
