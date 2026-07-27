// Ссылка на сайт практики автора + продуктовое событие practice_link_click
// (правило №8): place — откуда кликнули. Одна точка правды для URL и трека.
// Лендинг видят только неавторизованные гости, поэтому событие анонимное —
// через POST /api/public-event (userId = null).
import { api } from '../../api';
import {
  PRACTICE_LINK_CLICK_EVENT,
  type PracticeLinkPlace,
} from '../../../../shared/src/share/analytics';

export const AUTHOR_SITE = 'https://kotlarewski.gr';

export const trackPracticeClick = (place: PracticeLinkPlace): void => {
  api.trackPublicEvent(PRACTICE_LINK_CLICK_EVENT, { place });
};
