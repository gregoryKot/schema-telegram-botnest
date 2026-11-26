// Событие links_page_click (правило №8): что нажали и из какой соцсети пришли. Гость без
// входа — анонимный POST /api/public-event; keepalive: переход в той же вкладке не обрывает запрос.
import { api } from '../../api';
import { LINKS_PAGE_CLICK_EVENT } from '../../../../shared/src/share/analytics';
import { linksPageFrom } from '../../../../shared/src/analytics/linksPage';
import type { LinksPageTarget } from '../../../../shared/src/analytics/linksPageTargets';

export const trackLinksClick = (target: LinksPageTarget, search: string = window.location.search): void => {
  api.trackPublicEvent(LINKS_PAGE_CLICK_EVENT, { target, from: linksPageFrom(search) }, { keepalive: true });
};
