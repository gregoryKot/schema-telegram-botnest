import { sanitizeGameMeta } from './game-events.constants';
import { WEEK_CHAPTERS, WEEK_CTA_PLACES } from './game-week.constants';

describe('sanitizeGameMeta: игра «Неделя»', () => {
  it.each(WEEK_CHAPTERS)('глава %s проходит', (chapter) => {
    expect(sanitizeGameMeta('game_chapter_start', { chapter })).toEqual({
      chapter,
    });
    expect(sanitizeGameMeta('game_chapter_done', { chapter })).toEqual({
      chapter,
    });
  });

  it.each(WEEK_CTA_PLACES)('место зова %s проходит', (from) => {
    expect(sanitizeGameMeta('game_cta_shown', { from })).toEqual({ from });
    expect(sanitizeGameMeta('game_share', { from })).toEqual({ from });
    expect(
      sanitizeGameMeta('game_cta_click', { from, to: 'booking', x: 1 }),
    ).toEqual({ from, to: 'booking' });
    expect(sanitizeGameMeta('game_cta_click', { from, to: 'app' })).toEqual({
      from,
      to: 'app',
    });
  });

  it('чужая глава и чужое место — null', () => {
    expect(
      sanitizeGameMeta('game_chapter_start', { chapter: 'tue' }),
    ).toBeNull();
    expect(sanitizeGameMeta('game_cta_shown', { from: 'nowhere' })).toBeNull();
    expect(sanitizeGameMeta('game_cta_click', { from: 7 })).toBeNull();
  });
});
