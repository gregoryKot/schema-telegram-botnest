import { sanitizeMeta } from './analytics-meta.sanitize';
import { SELF_MAP_LINK_TARGETS } from '../analytics/self-map-events.constants';

describe('sanitizeMeta: self_map_link', () => {
  it.each(SELF_MAP_LINK_TARGETS)('пропускает to=%s и режет лишнее', (to) => {
    expect(
      sanitizeMeta('self_map_link', { to, text: 'x', modeId: 'a' }),
    ).toEqual({
      to,
    });
  });

  it.each([{ to: 'evil' }, { to: 5 }, {}])(
    'неизвестное -> undefined (%j)',
    (m) => {
      expect(sanitizeMeta('self_map_link', m)).toBeUndefined();
    },
  );
});
