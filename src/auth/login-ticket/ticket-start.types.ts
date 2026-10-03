// Вход шага 1 жизненного цикла билета. Вынесено из login-ticket.types.ts
// (правило №10: файл не растёт сверх зафиксированного размера).
import type { TicketIntent } from './login-ticket.types';

export interface StartTicketInput {
  intent: TicketIntent;
  provider: string;
  /** Кто просит. У `intent: 'login'` хозяина нет — там null. */
  requesterUserId: bigint | null;
  hostId: string;
  deviceLabel: string;
}
