import { api } from '../../api';
import {
  THERAPY_NUDGE_EVENT,
  type TherapyNudgeAction,
  type TherapyNudgePlace,
  type TherapyNudgeTrigger,
} from '../../../../shared/src/analytics/therapyNudge';

/** Событие «моста к терапевту»; meta — место, действие и (у карточки по сигналу) причина, без текстов пользователя. */
export function trackTherapyNudge(
  place: TherapyNudgePlace,
  action: TherapyNudgeAction,
  trigger?: TherapyNudgeTrigger,
): void {
  api.trackEvent(THERAPY_NUDGE_EVENT, trigger ? { place, action, trigger } : { place, action });
}
