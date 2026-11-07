import {
  THERAPY_NUDGE_ACTIONS,
  THERAPY_NUDGE_PLACES,
  THERAPY_NUDGE_TRIGGERS,
} from '../analytics/therapy-nudge.constants';

const PLACE_SET = new Set<string>(THERAPY_NUDGE_PLACES);
const ACTION_SET = new Set<string>(THERAPY_NUDGE_ACTIONS);
const TRIGGER_SET = new Set<string>(THERAPY_NUDGE_TRIGGERS);

// Санитизация meta для therapy_nudge: только { place, action, trigger? } и
// только значения из allow-list (правило №7/№8). Нет места или действия —
// meta отбрасывается целиком; чужой trigger отбрасывается один.
export function sanitizeTherapyNudgeMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const { place, action, trigger } = meta;
  if (typeof place !== 'string' || !PLACE_SET.has(place)) return undefined;
  if (typeof action !== 'string' || !ACTION_SET.has(action)) return undefined;
  if (typeof trigger === 'string' && TRIGGER_SET.has(trigger)) {
    return { place, action, trigger };
  }
  return { place, action };
}
