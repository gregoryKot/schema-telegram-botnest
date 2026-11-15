// Что видит по токену самоотмены гость (страница возврата с оплаты) и клиент:
// статус, время и длину встречи — без имени, контакта, ссылки и служебных полей.
import { NotFoundException } from '@nestjs/common';
import { BookingStatus, SessionType } from '@prisma/client';
import { getPublicBookingByToken } from './booking-public-view';

const stored = {
  id: 'b-1',
  userId: 7,
  status: BookingStatus.CONFIRMED,
  type: SessionType.SESSION_50,
  startsAt: new Date('2026-12-01T09:30:00Z'),
  durationMin: 50,
  paidAt: new Date('2026-11-30T12:00:00Z'),
  amountKopecks: 400000,
  cancelToken: 'tok-1',
  clientName: 'Чужое Имя',
  clientContact: 'someone@example.com',
  meetingUrl: 'https://meet.example/room?pwd=1',
  invId: 99,
};

function prismaWith(found: Record<string, unknown> | null) {
  const findUnique = jest.fn().mockResolvedValue(found);
  return { prisma: { booking: { findUnique } } as never, findUnique };
}

describe('getPublicBookingByToken — публичная выдача брони', () => {
  it('ищет бронь ровно по токену самоотмены', async () => {
    const { prisma, findUnique } = prismaWith(stored);
    await getPublicBookingByToken(prisma, 'tok-1');
    expect(findUnique).toHaveBeenCalledWith({
      where: { cancelToken: 'tok-1' },
    });
  });

  it('чужой или протухший токен → 404, а не пустая бронь', async () => {
    const { prisma } = prismaWith(null);
    const call = getPublicBookingByToken(prisma, 'nope');
    await expect(call).rejects.toThrow(NotFoundException);
    await expect(call).rejects.toThrow('Booking not found');
  });

  it('отдаёт только статус, оплату, тип и время — ни одного поля человека', async () => {
    const { prisma } = prismaWith(stored);
    expect(await getPublicBookingByToken(prisma, 'tok-1')).toEqual({
      status: BookingStatus.CONFIRMED,
      paid: true,
      type: SessionType.SESSION_50,
      startsAt: '2026-12-01T09:30:00.000Z',
      endsAt: '2026-12-01T10:20:00.000Z',
      durationMin: 50,
    });
  });
});
