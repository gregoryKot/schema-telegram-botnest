import { BookingStatus } from '@prisma/client';
import { encryptRecord } from '../utils/crypto';
import { BOOKING_SCHEMA } from './booking.schema';
import { isValidTimeZone } from './client-timezone';
import type { CreateBookingDto } from './booking.types';
import type { BookingPricePath } from './booking-pricing-path';

/**
 * Строка новой брони для INSERT: бесплатная сессия и платная не в рублях
 * подтверждены сразу, платная в рублях держится HELD до `heldUntil`; PII
 * зашифрована. Вынесено из booking.service.ts (правило №10).
 */
export function buildBookingData(
  dto: CreateBookingDto,
  opts: BookingPricePath & { cancelToken: string },
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
      status:
        opts.isFree || opts.manual
          ? BookingStatus.CONFIRMED
          : BookingStatus.HELD,
      heldUntil: opts.heldUntil,
      amount: opts.amount,
      currency: opts.currency,
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
