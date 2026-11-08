// Платформа запуска: клиенту верим только в пределах списка (аудит 2026-10).
import {
  LAUNCH_PLATFORMS,
  messengerLaunchMeta,
  normalizeLaunchPlatform,
} from './launch-platforms.constants';

describe('normalizeLaunchPlatform', () => {
  it.each(LAUNCH_PLATFORMS)(
    'известная платформа «%s» проходит как есть',
    (p) => {
      expect(normalizeLaunchPlatform(p)).toBe(p);
    },
  );

  it.each([undefined, null, '', 'unknown', 'IOS', 'ios ', 42, { p: 'ios' }])(
    'незнакомое значение %p — other',
    (raw) => {
      expect(normalizeLaunchPlatform(raw)).toBe('other');
    },
  );
});

describe('messengerLaunchMeta', () => {
  it('только площадка и платформа из списка', () => {
    expect(messengerLaunchMeta('max', 'desktop')).toEqual({
      host: 'max',
      platform: 'desktop',
    });
    expect(messengerLaunchMeta('telegram', 'x'.repeat(32))).toEqual({
      host: 'telegram',
      platform: 'other',
    });
  });
});
