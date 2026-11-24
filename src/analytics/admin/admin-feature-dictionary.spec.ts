import { ANALYTICS_EVENTS } from '../analytics.constants';
import {
  FEATURES,
  OTHER_EVENTS,
  OTHER_FEATURE,
  featureOf,
} from './admin-feature-dictionary';

describe('словарь фич админки', () => {
  const mapped = FEATURES.flatMap((f) => f.events);

  it('каждое событие реестра есть в словаре или явно в «Другом»', () => {
    const known = new Set<string>([...mapped, ...OTHER_EVENTS]);
    const missing = ANALYTICS_EVENTS.filter((e) => !known.has(e));
    expect(missing).toEqual([]);
  });

  it('событие не живёт в двух фичах и не лежит одновременно в «Другом»', () => {
    const all = [...mapped, ...OTHER_EVENTS];
    expect(all.filter((e, i) => all.indexOf(e) !== i)).toEqual([]);
  });

  it('id и названия фич уникальны, названия без имён событий', () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FEATURES) {
      expect(f.title).not.toMatch(/^[a-z_]+$/);
      expect(f.events.length).toBeGreaterThan(0);
    }
  });

  it('featureOf: известное — своя фича, неизвестное и служебное — «Другое»', () => {
    expect(featureOf('share_card').id).toBe('share');
    expect(featureOf('mode_entry_saved').title).toBe('Дневник режимов');
    expect(featureOf('no_such_event')).toEqual(OTHER_FEATURE);
    expect(featureOf('client_error')).toEqual(OTHER_FEATURE);
  });
});
