import { sanitizeMeta } from './analytics-meta.sanitize';
import { sanitizeHomeTileMeta } from './analytics-meta.sanitize-home';
import { HOME_TILES } from '../analytics/home-events.constants';

describe('home_tile: санитизация meta', () => {
  it.each(HOME_TILES)(
    'плитка %s проходит, лишние поля отбрасываются',
    (tile) => {
      expect(sanitizeHomeTileMeta({ tile, text: 'мой дневник' })).toEqual({
        tile,
      });
      expect(sanitizeMeta('home_tile', { tile, extra: 1 })).toEqual({ tile });
    },
  );

  it('неизвестная плитка, не строка и пустая meta отбрасываются целиком', () => {
    expect(sanitizeMeta('home_tile', { tile: 'secret' })).toBeUndefined();
    expect(sanitizeMeta('home_tile', { tile: 1 })).toBeUndefined();
    expect(sanitizeMeta('home_tile', {})).toBeUndefined();
    expect(sanitizeMeta('home_tile', undefined)).toBeUndefined();
  });
});
