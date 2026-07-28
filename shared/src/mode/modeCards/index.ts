/**
 * Единый источник содержательного «портрета режима» на все 35 режимов
 * схема-терапии (см. types.ts для правил тона и структуры полей).
 * Склейка по группам — child/coping/overcompensation/critic/healthy —
 * каждая ≤300 строк (правило №10 CLAUDE.md).
 */
import { CHILD_MODE_CARDS } from './child';
import { COPING_MODE_CARDS } from './coping';
import { OVERCOMPENSATION_MODE_CARDS } from './overcompensation';
import { CRITIC_MODE_CARDS } from './critic';
import { HEALTHY_MODE_CARDS } from './healthy';
import type { ModeCard } from './types';

export type { ModeCard } from './types';

export const MODE_CARDS: Record<string, ModeCard> = {
  ...CHILD_MODE_CARDS,
  ...COPING_MODE_CARDS,
  ...OVERCOMPENSATION_MODE_CARDS,
  ...CRITIC_MODE_CARDS,
  ...HEALTHY_MODE_CARDS,
};

/** Портрет режима по id (MODE_GROUPS.items[].id) или undefined, если не найден. */
export function getModeCard(id: string): ModeCard | undefined {
  return MODE_CARDS[id];
}
