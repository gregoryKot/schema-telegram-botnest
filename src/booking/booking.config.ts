import { SessionType } from '@prisma/client';

// Session catalogue. Prices are editable in the admin panel (stored in
// BookingSetting); the values here are only the initial defaults / fallbacks.
// Labels, durations and notes are static metadata.

export const SESSION_DEFAULT_PRICE: Record<SessionType, number> = {
  [SessionType.INTRO_15]: 0,
  [SessionType.SESSION_50]: 4000,
};

// Booking window rules.
//   MIN_BOOK_LEAD_HOURS   — a slot must start at least this many hours from now
//                           (no last-minute bookings the therapist can't prepare for).
//   MIN_CANCEL_LEAD_HOURS — a client may self-cancel only this far ahead.
export const MIN_BOOK_LEAD_HOURS = 12;
export const MIN_CANCEL_LEAD_HOURS = 24;

// Subscription (recurring support). Prices editable in admin (BookingSetting
// keys sub:month / sub:year); these are the initial defaults.
export type SubPeriod = 'month' | 'year';
export const SUB_DEFAULT_PRICE: Record<SubPeriod, number> = {
  month: 500,
  year: 5000,
};

export interface SessionMeta {
  type: SessionType;
  label: string;
  durationMin: number;
  note: string;
}

export const SESSION_META: SessionMeta[] = [
  {
    type: SessionType.INTRO_15,
    label: 'Знакомство',
    durationMin: 15,
    note: '15 минут · бесплатно',
  },
  {
    type: SessionType.SESSION_50,
    label: 'Сессия',
    durationMin: 50,
    note: '50 минут',
  },
];

export interface SessionOption extends SessionMeta {
  price: number;
}
