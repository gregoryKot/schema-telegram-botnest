import { describe, expect, it } from 'vitest';
import { LAUNCH_PLATFORMS, launchPlatform } from './launchPlatform';

describe('launchPlatform', () => {
  it.each(LAUNCH_PLATFORMS)('известная платформа «%s» уходит как есть', (p) => {
    expect(launchPlatform(p)).toBe(p);
  });

  it.each([undefined, '', 'unknown', 'IOS', 'tizen'])(
    'незнакомое значение %s — other',
    (raw) => {
      expect(launchPlatform(raw)).toBe('other');
    },
  );
});
