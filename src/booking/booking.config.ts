import { SessionType } from '@prisma/client';

// Session catalogue. Prices are editable in the admin panel (stored in
// BookingSetting); the values here are only the initial defaults / fallbacks.
// Labels, durations and notes are static metadata.

export const SESSION_DEFAULT_PRICE: Record<SessionType, number> = {
  [SessionType.INTRO_15]: 0,
  [SessionType.SESSION_50]: 4000,
};

export interface SessionMeta {
  type: SessionType;
  label: string;
  durationMin: number;
  note: string;
}

export const SESSION_META: SessionMeta[] = [
  { type: SessionType.INTRO_15,  label: 'Знакомство', durationMin: 15, note: '15 минут · бесплатно' },
  { type: SessionType.SESSION_50, label: 'Сессия',     durationMin: 50, note: '50 минут' },
];

export interface SessionOption extends SessionMeta {
  price: number;
}
