import { api } from '../../api';
import type { HomeTile } from '../../../../shared/src/analytics/homeTile';

/** Нажатие плитки или ссылки на главной — событие home_tile (/stats: «Главная: плитки»). Fire-and-forget. */
export function trackHomeTile(tile: HomeTile): void {
  api.trackEvent('home_tile', { tile });
}
