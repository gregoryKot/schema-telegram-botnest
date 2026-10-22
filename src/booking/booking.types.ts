import type { SessionType } from '@prisma/client';
import type { ContactChannel } from './contact-channel';

export interface CreateBookingDto {
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  clientName: string;
  clientContact: string;
  clientChannel?: ContactChannel;
  message?: string;
  /** Client ticked "returning visit" — require an existing personal meeting. */
  returning?: boolean;
  /** Client ticked the public-offer consent checkbox. Required to take payment. */
  acceptedOffer?: boolean;
  /** Атрибуция лида (страница + referrer). Не PII, хранится открыто. */
  source?: string;
  /** IANA-пояс посетителя из Intl. Невалидный — игнорируется (не 400). */
  clientTimeZone?: string;
}
