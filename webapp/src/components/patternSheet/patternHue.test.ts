import { describe, it, expect } from 'vitest';
import { patternHue } from './patternHue';
import { DOMAIN_HUE, MODE_GROUP_HUE } from '../../lib/tone';

describe('patternHue', () => {
  it('схема получает hue своего домена, режим — своей группы', () => {
    expect(patternHue('schema', 'abandonment')).toBe(DOMAIN_HUE.rejection);
    expect(patternHue('mode', 'vulnerable_child')).toBe(MODE_GROUP_HUE.child);
  });

  it('неизвестный id — undefined (hueStyle подставит нейтральный)', () => {
    expect(patternHue('schema', 'nope')).toBeUndefined();
    expect(patternHue('mode', 'nope')).toBeUndefined();
  });
});
