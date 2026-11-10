import { describe, it, expect } from 'vitest';
import { patternHue, patternLook } from './patternHue';
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

describe('patternLook — вид героя паттерна', () => {
  it('схема — бумага и знак своего домена', () => {
    expect(patternLook('schema', 'abandonment')).toEqual({ hue: DOMAIN_HUE.rejection, sign: 'domain_rejection' });
    expect(patternLook('schema', 'unrelenting_standards')).toEqual({ hue: DOMAIN_HUE.vigilance, sign: 'domain_vigilance' });
  });

  it('режим — бумага группы и знак группы; «Сердитый Ребёнок» — свой знак (решение 6)', () => {
    expect(patternLook('mode', 'punitive_critic')).toEqual({ hue: MODE_GROUP_HUE.critic, sign: 'looming' });
    expect(patternLook('mode', 'angry_child')).toEqual({ hue: MODE_GROUP_HUE.child, sign: 'flare' });
  });

  it('бумага вида совпадает с patternHue — экран и строка списка не расходятся', () => {
    for (const [kind, id] of [['schema', 'abandonment'], ['mode', 'healthy_adult']] as const) {
      expect(patternLook(kind, id)?.hue).toBe(patternHue(kind, id));
    }
  });

  it('неизвестный id — null, без выдуманного знака', () => {
    expect(patternLook('schema', 'nope')).toBeNull();
    expect(patternLook('mode', 'nope')).toBeNull();
  });
});
