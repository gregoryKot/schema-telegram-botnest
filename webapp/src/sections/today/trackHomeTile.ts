import { api } from '../../api';
import { HOME_TILE_EVENT, TRACKER_SKIP_EVENT, type HomeTile } from '../../../../shared/src/analytics/homeTile';

/** Нажатие плитки или ссылки на главной — событие home_tile (/stats: «Главная: плитки»). Fire-and-forget. */
export function trackHomeTile(tile: HomeTile): void {
  api.trackEvent(HOME_TILE_EVENT, { tile });
}

/** «Пропустить» на вопросе трекера — событие tracker_skip без meta (/stats: «Трекер: пропусков N»). Fire-and-forget. */
export function trackTrackerSkip(): void {
  api.trackEvent(TRACKER_SKIP_EVENT);
}
