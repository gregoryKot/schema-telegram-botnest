// Вид сущностей на карточках шаринга — строки ENTITY_LOOK и ACHIEVEMENT_LOOK; каждый знак карточки
// есть в canvas, у значков достижений — число фигур мотива.
import { describe, it, expect } from 'vitest';
import { CARD_LOOK, INVITE_LOOK, achievementCardLook } from './cardLook';
import { ACHIEVEMENT_LOOK, ENTITY_LOOK } from '../../theme/entityLook';
import { canvasSign, lookDrawing } from './signs';
import { countedDrawing } from './countedSigns';

const ACHIEVEMENTS = Object.keys(ACHIEVEMENT_LOOK);

describe('CARD_LOOK', () => {
  it.each(Object.entries(CARD_LOOK))(
    '%s — оттенок и знак из ENTITY_LOOK, знак есть на canvas',
    (id, look) => {
      expect(look).toBe(ENTITY_LOOK[id as keyof typeof ENTITY_LOOK]);
      expect(canvasSign(look.sign)).toBe(look.sign);
    },
  );
});

describe('achievementCardLook', () => {
  it.each(ACHIEVEMENTS)(
    '%s — оттенок и знак значка из ACHIEVEMENT_LOOK, рисунок на canvas (с вариантом по счёту)',
    (id) => {
      const look = achievementCardLook(id)!;
      expect(look).toMatchObject(ACHIEVEMENT_LOOK[id]);
      expect(lookDrawing(look)).not.toBeNull();
      if (look.n !== undefined)
        expect(countedDrawing(look.sign, look.n)?.prims).toHaveLength(look.n);
    },
  );

  it('у двух достижений нет одинакового значка: знак и число фигур различаются', () => {
    const keys = ACHIEVEMENTS.map((id) => {
      const l = achievementCardLook(id)!;
      return `${l.sign}:${l.n ?? ''}`;
    });
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('серия: полосок больше к длинной серии; дни всего: листов больше', () => {
    const n = (id: string) => achievementCardLook(id)?.n ?? 0;
    const series = [
      'streak_3',
      'streak_7',
      'streak_14',
      'streak_30',
      'streak_100',
    ].map(n);
    expect([...series].sort((a, b) => a - b)).toEqual(series);
    expect(n('total_50')).toBeGreaterThan(n('total_10'));
  });

  it('незнакомое достижение — без знака', () => {
    expect(achievementCardLook('streak_7')).toEqual({
      hue: 70,
      sign: 'strokes',
      n: 3,
    });
    expect(achievementCardLook('hasOwnProperty')).toBeNull();
    expect(achievementCardLook(undefined)).toBeNull();
  });
});

describe('INVITE_LOOK', () => {
  it('пара — сущность pair, терапевт — сущность therapist, знаки есть на canvas', () => {
    expect(INVITE_LOOK.pair).toBe(ENTITY_LOOK.pair);
    expect(INVITE_LOOK.therapist).toMatchObject({ hue: 240, sign: 'talk' });
    for (const l of Object.values(INVITE_LOOK))
      expect(canvasSign(l.sign)).toBe(l.sign);
  });
});
