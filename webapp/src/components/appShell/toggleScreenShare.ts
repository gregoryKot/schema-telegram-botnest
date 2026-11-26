import { api } from '../../api';
import { setScreenShare } from './screenShareMode';

/** Переключает «Показ экрана» (тумблер в меню и строка общего поиска); событие — только включение. */
export function toggleScreenShare(on: boolean): void {
  if (!on) api.trackEvent('cabinet_screen_share_on');
  setScreenShare(!on);
}
