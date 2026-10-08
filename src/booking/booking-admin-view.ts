import { decryptRecord, EncryptSchema } from '../utils/crypto';
import { BOOKING_SCHEMA } from './booking.schema';

// Как показать бронь админу. У обезличенной брони (крон
// booking-retention.service.ts стёр имя через 12 месяцев) расшифрованное имя —
// пустая строка, и без подписи строка календаря или списка выглядела бы
// безымянной, то есть поломкой. Одно место для обеих админских выдач
// (календарь слотов и список записей): подпись не должна разъезжаться.
export const ANONYMIZED_CLIENT_LABEL = 'обезличено';

/** Имя для показа: пустое (стёрто по сроку) заменяется подписью. */
export function displayClientName(name: string | null | undefined): string {
  return name && name.trim() !== '' ? name : ANONYMIZED_CLIENT_LABEL;
}

/** decryptRecord для админских выдач: стёртое по сроку имя — с подписью. */
export function decryptBookingForAdmin<
  T extends Record<string, unknown> & { clientName: string },
>(row: T, schema: EncryptSchema = BOOKING_SCHEMA): T {
  const plain = decryptRecord(row, schema);
  return { ...plain, clientName: displayClientName(plain.clientName) };
}
