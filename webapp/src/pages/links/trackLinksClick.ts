// Событие links_page_click (правило №8): какую кнопку нажали и из какой соцсети
// пришли. Гость без входа — анонимный путь POST /api/public-event; сбой
// отправки глотает сам api.trackPublicEvent, переход по ссылке он не держит.
import { api } from '../../api';
import { LINKS_PAGE_CLICK_EVENT } from '../../../../shared/src/share/analytics';
import { linksPageFrom, type LinksPageTarget } from '../../../../shared/src/analytics/linksPage';

export const trackLinksClick = (target: LinksPageTarget, search: string = window.location.search): void => {
  api.trackPublicEvent(LINKS_PAGE_CLICK_EVENT, { target, from: linksPageFrom(search) });
};
