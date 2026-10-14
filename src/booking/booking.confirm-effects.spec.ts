// finishConfirmEffects — общий вход для confirm() и крон-добора (security#21).
import { BookingStatus } from '@prisma/client';
import {
  ConfirmEffectsFailedError,
  finishConfirmEffects,
} from './booking.confirm-effects';

const row = (over: Record<string, unknown> = {}) =>
  ({
    id: 11,
    status: BookingStatus.CONFIRMED,
    startsAt: new Date('2026-12-01T10:00:00Z'),
    durationMin: 50,
    type: 'SESSION_50',
    clientName: 'Мария',
    clientContact: '@maria',
    message: null,
    meetingUrl: null,
    cancelToken: 'tok',
    confirmEffectsDoneAt: null,
    ...over,
  }) as never;

describe('finishConfirmEffects', () => {
  it('флаг пуст: зовёт onConfirmed с расшифрованной строкой и возвращает true', async () => {
    const notify = { onConfirmed: jest.fn(async () => undefined) };

    await expect(finishConfirmEffects(notify as never, row())).resolves.toBe(
      true,
    );

    expect(notify.onConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 11, clientName: 'Мария' }),
    );
  });

  it('флаг стоит: эффекты не зовутся, ответ false', async () => {
    const notify = { onConfirmed: jest.fn(async () => undefined) };

    await expect(
      finishConfirmEffects(
        notify as never,
        row({ confirmEffectsDoneAt: new Date() }),
      ),
    ).resolves.toBe(false);

    expect(notify.onConfirmed.mock.calls).toHaveLength(0);
  });

  it('исключение эффектов заворачивается в ConfirmEffectsFailedError с id брони и причиной', async () => {
    const boom = new Error("Can't reach database server");
    const notify = {
      onConfirmed: jest.fn(async () => {
        throw boom;
      }),
    };

    const err = await finishConfirmEffects(notify as never, row()).catch(
      (e) => e,
    );

    expect(err).toBeInstanceOf(ConfirmEffectsFailedError);
    expect(err.bookingId).toBe(11);
    expect(err.cause).toBe(boom);
    expect(err.message).toContain('#11');
    expect(err.message).toContain("Can't reach database server");
  });
});
