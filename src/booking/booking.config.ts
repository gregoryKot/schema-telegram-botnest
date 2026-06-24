import { SessionType } from '@prisma/client';

// Session catalogue — single source of truth for prices and labels, shared by
// the booking service (pricing) and the public /options endpoint (UI display).
// Prices are in whole rubles. INTRO_15 is free and confirms without payment.

export const SESSION_PRICE: Record<SessionType, number> = {
  [SessionType.INTRO_15]: 0,
  [SessionType.SESSION_50]: 4000,  // matches the price shown on the site (#prices + FAQ)
};

export interface SessionOption {
  type: SessionType;
  label: string;
  durationMin: number;
  price: number;
  note: string;
}

export const SESSION_OPTIONS: SessionOption[] = [
  { type: SessionType.INTRO_15,  label: 'Знакомство', durationMin: 15, price: SESSION_PRICE[SessionType.INTRO_15],  note: '15 минут · бесплатно' },
  { type: SessionType.SESSION_50, label: 'Сессия',     durationMin: 50, price: SESSION_PRICE[SessionType.SESSION_50], note: '50 минут' },
];
