import { api } from '../../api';
import { DONE_NEXT_STEP_EVENT, HOME_TILE_EVENT, TRACKER_SKIP_EVENT, type DoneNextStepMeta, type HomeTile } from '../../../../shared/src/analytics/homeTile';

/** Нажатие плитки или ссылки на главной — событие home_tile (/stats: «Главная: плитки»). Fire-and-forget. */
export function trackHomeTile(tile: HomeTile): void {
  api.trackEvent(HOME_TILE_EVENT, { tile });
}

/** «Пропустить» на вопросе трекера — событие tracker_skip без meta (/stats: «Трекер: пропусков N»). Fire-and-forget. */
export function trackTrackerSkip(): void {
  api.trackEvent(TRACKER_SKIP_EVENT);
}

/** Переход по «что дальше» с «Готово» трекера или после быстрой записи — событие done_next_step. Fire-and-forget. */
export function trackDoneNextStep(meta: DoneNextStepMeta): void {
  api.trackEvent(DONE_NEXT_STEP_EVENT, { ...meta });
}
