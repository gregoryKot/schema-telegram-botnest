import { sanitizeMeta } from './analytics-meta.sanitize';
import { sanitizeTherapyNudgeMeta } from './analytics-meta.sanitize-therapy-nudge';
import {
  THERAPY_NUDGE_ACTIONS,
  THERAPY_NUDGE_EVENT,
  THERAPY_NUDGE_PLACES,
  THERAPY_NUDGE_TRIGGERS,
} from '../analytics/therapy-nudge.constants';
import { ANALYTICS_EVENTS } from '../analytics/analytics.constants';

describe('therapy_nudge: санитизация meta', () => {
  it('событие есть в allow-list', () => {
    expect(ANALYTICS_EVENTS).toContain(THERAPY_NUDGE_EVENT);
  });

  it.each(THERAPY_NUDGE_PLACES)(
    'место %s проходит, лишние поля уходят',
    (place) => {
      expect(
        sanitizeMeta(THERAPY_NUDGE_EVENT, {
          place,
          action: 'shown',
          text: 'мой дневник',
          x: 1,
        }),
      ).toEqual({ place, action: 'shown' });
    },
  );

  it.each(THERAPY_NUDGE_ACTIONS)('действие %s проходит', (action) => {
    expect(sanitizeTherapyNudgeMeta({ place: 'home', action })).toEqual({
      place: 'home',
      action,
    });
  });

  it.each(THERAPY_NUDGE_TRIGGERS)('причина %s проходит', (trigger) => {
    expect(
      sanitizeMeta(THERAPY_NUDGE_EVENT, {
        place: 'signal_card',
        action: 'shown',
        trigger,
      }),
    ).toEqual({ place: 'signal_card', action: 'shown', trigger });
  });

  it('чужая причина отбрасывается одна, место и действие остаются', () => {
    expect(
      sanitizeMeta(THERAPY_NUDGE_EVENT, {
        place: 'home',
        action: 'open',
        trigger: 'secret',
      }),
    ).toEqual({ place: 'home', action: 'open' });
    expect(
      sanitizeMeta(THERAPY_NUDGE_EVENT, {
        place: 'home',
        action: 'open',
        trigger: 5,
      }),
    ).toEqual({ place: 'home', action: 'open' });
  });

  it('чужое место или действие, не строка и пустая meta отбрасываются целиком', () => {
    const bad = [
      { place: 'secret', action: 'shown' },
      { place: 'home', action: 'secret' },
      { place: 1, action: 'shown' },
      { place: 'home', action: 2 },
      { place: 'home' },
      { action: 'shown' },
      {},
    ];
    for (const meta of bad) {
      expect(sanitizeMeta(THERAPY_NUDGE_EVENT, meta)).toBeUndefined();
    }
    expect(sanitizeMeta(THERAPY_NUDGE_EVENT, undefined)).toBeUndefined();
  });
});
