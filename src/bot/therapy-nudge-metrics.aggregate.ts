import {
  THERAPY_NUDGE_PLACES,
  THERAPY_NUDGE_TRIGGERS,
} from '../analytics/therapy-nudge.constants';
import type { TherapyNudgeMetrics } from './therapy-nudge-metrics.format';

export type TherapyNudgeCounts = Omit<
  TherapyNudgeMetrics,
  'introFromApp' | 'bookingFromApp'
>;

// Чистый агрегат meta событий therapy_nudge за период: один проход по
// строкам вместо запроса на каждое место (их 17) и каждую причину. Чужие
// значения place/action/trigger (сервер их и так режет при приёме) не
// считаются ни в одну корзину.
export function aggregateTherapyNudge(metas: unknown[]): TherapyNudgeCounts {
  const shown = new Map<string, number>(
    THERAPY_NUDGE_PLACES.map((place) => [place, 0]),
  );
  const triggers = new Map<string, number>(
    THERAPY_NUDGE_TRIGGERS.map((trigger) => [trigger, 0]),
  );
  const actions = { open: 0, book: 0, write: 0, dismiss: 0, session: 0 };
  for (const raw of metas) {
    if (!raw || typeof raw !== 'object') continue;
    const { place, action, trigger } = raw as Record<string, unknown>;
    if (typeof action !== 'string') continue;
    if (action === 'shown') {
      if (typeof place === 'string' && shown.has(place)) {
        shown.set(place, (shown.get(place) ?? 0) + 1);
      }
      if (
        place === 'signal_card' &&
        typeof trigger === 'string' &&
        triggers.has(trigger)
      ) {
        triggers.set(trigger, (triggers.get(trigger) ?? 0) + 1);
      }
    } else if (action in actions) {
      actions[action as keyof typeof actions] += 1;
    }
  }
  return {
    shownByPlace: THERAPY_NUDGE_PLACES.map((place) => ({
      place,
      count: shown.get(place) ?? 0,
    })),
    signalByTrigger: THERAPY_NUDGE_TRIGGERS.map((trigger) => ({
      trigger,
      count: triggers.get(trigger) ?? 0,
    })),
    ...actions,
  };
}
