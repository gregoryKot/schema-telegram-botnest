import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_LOOK } from '../../../../shared/src/theme/entityLook';
import { ACHIEVEMENT_LOOK_LIT, badgeLook } from './achievementBadgeLook';

describe('achievementBadgeLook — литералы совпадают с ACHIEVEMENT_LOOK (правило №4)', () => {
  it('та же таблица: оттенок и знак каждого значка', () => {
    expect(ACHIEVEMENT_LOOK_LIT).toEqual(ACHIEVEMENT_LOOK);
  });
  it('незнакомое и ключ прототипа — null', () => {
    expect(badgeLook('hasOwnProperty')).toBeNull();
    expect(badgeLook('streak_7')).toEqual({ hue: 70, sign: 'strokes' });
  });
});
