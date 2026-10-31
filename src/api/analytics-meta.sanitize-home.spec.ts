import { sanitizeMeta } from './analytics-meta.sanitize';
import { sanitizeHomeTileMeta } from './analytics-meta.sanitize-home';
import {
  DIARY_QUICK_TAGS,
  HOME_TILES,
} from '../analytics/home-events.constants';

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

describe('tracker_skip: санитизация meta', () => {
  it('любая присланная meta отбрасывается до пустого объекта', () => {
    expect(sanitizeMeta('tracker_skip', { text: 'мой дневник', x: 1 })).toEqual(
      {},
    );
    expect(sanitizeMeta('tracker_skip', {})).toEqual({});
  });

  it('без meta остаётся без meta', () => {
    expect(sanitizeMeta('tracker_skip', undefined)).toBeUndefined();
  });
});

describe('diary_quick_save: санитизация meta', () => {
  it.each(DIARY_QUICK_TAGS)(
    'тег %s проходит, detailed — только булев true',
    (tag) => {
      expect(
        sanitizeMeta('diary_quick_save', {
          tag,
          detailed: true,
          text: 'дневник',
        }),
      ).toEqual({ tag, detailed: true });
      expect(
        sanitizeMeta('diary_quick_save', { tag, detailed: 'yes' }),
      ).toEqual({
        tag,
        detailed: false,
      });
      expect(sanitizeMeta('diary_quick_save', { tag })).toEqual({
        tag,
        detailed: false,
      });
    },
  );

  it('неизвестный тег, не строка и пустая meta отбрасываются целиком', () => {
    expect(
      sanitizeMeta('diary_quick_save', { tag: 'secret', detailed: true }),
    ).toBeUndefined();
    expect(sanitizeMeta('diary_quick_save', { tag: 1 })).toBeUndefined();
    expect(sanitizeMeta('diary_quick_save', {})).toBeUndefined();
    expect(sanitizeMeta('diary_quick_save', undefined)).toBeUndefined();
  });
});
