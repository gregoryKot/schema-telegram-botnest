import { BookingStatus } from '@prisma/client';
import { encryptRecord } from '../utils/crypto';
import { BOOKING_SCHEMA } from './booking.schema';
import { isValidTimeZone } from './client-timezone';
import type { CreateBookingDto } from './booking.types';

/**
 * Строка новой брони для INSERT: бесплатная сессия подтверждена сразу, платная
 * держится HELD до `heldUntil`; PII зашифрована. Вынесено из booking.service.ts
 * (правило №10).
 */
export function buildBookingData(
  dto: CreateBookingDto,
  opts: {
    isFree: boolean;
    heldUntil: Date | null;
    cancelToken: string;
    /** Сумма счёта, рубли; null у бесплатного знакомства. */
    amount: number | null;
  },
) {
  return encryptRecord(
    {
      startsAt: dto.startsAt,
      durationMin: dto.durationMin,
      type: dto.type,
      clientName: dto.clientName,
      clientContact: dto.clientContact,
      clientChannel: dto.clientChannel ?? null,
      message: dto.message ?? null,
      status: opts.isFree ? BookingStatus.CONFIRMED : BookingStatus.HELD,
      heldUntil: opts.heldUntil,
      amount: opts.amount,
      cancelToken: opts.cancelToken,
      acceptedOfferAt: new Date(),
      source: dto.source ?? null,
      clientTimeZone:
        dto.clientTimeZone && isValidTimeZone(dto.clientTimeZone)
          ? dto.clientTimeZone
          : null,
    },
    BOOKING_SCHEMA,
  );
}
