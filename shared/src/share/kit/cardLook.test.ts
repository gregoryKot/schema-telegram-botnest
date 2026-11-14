// Вид сущностей на карточках шаринга = ENTITY_LOOK (правило №4): литералы рядом с китом
// (обход ловушки чанков) не расходятся с таблицей вида; каждый знак карточки есть в canvas.
import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENT_CARD_LOOK,
  CARD_LOOK,
  INVITE_LOOK,
  achievementCardLook,
} from './cardLook';
import { ACHIEVEMENT_LOOK, ENTITY_LOOK } from '../../theme/entityLook';
import { canvasSign, lookDrawing } from './signs';
import { countedDrawing } from './countedSigns';

describe('CARD_LOOK', () => {
  it.each(Object.entries(CARD_LOOK))(
    '%s — оттенок и знак из ENTITY_LOOK',
    (id, look) => {
      const entity = ENTITY_LOOK[id as keyof typeof ENTITY_LOOK];
      expect(entity).toBeDefined();
      expect({ hue: look.hue, sign: look.sign }).toEqual({
        hue: entity.hue,
        sign: entity.sign,
      });
      expect(canvasSign(look.sign)).toBe(look.sign);
    },
  );
});

describe('ACHIEVEMENT_CARD_LOOK', () => {
  it('оттенок и знак = ACHIEVEMENT_LOOK значка (правило №4)', () => {
    const hueSign = Object.fromEntries(
      Object.entries(ACHIEVEMENT_CARD_LOOK).map(([id, l]) => [
        id,
        { hue: l.hue, sign: l.sign },
      ]),
    );
    expect(hueSign).toEqual(ACHIEVEMENT_LOOK);
  });

  it.each(Object.entries(ACHIEVEMENT_CARD_LOOK))(
    'у достижения %s есть рисунок на canvas (с вариантом по счёту)',
    (_id, look) => {
      expect(lookDrawing(look)).not.toBeNull();
      if (look.n !== undefined)
        expect(countedDrawing(look.sign, look.n)?.prims).toHaveLength(look.n);
    },
  );

  it('у двух достижений нет одинакового значка: знак и число фигур различаются', () => {
    const keys = Object.values(ACHIEVEMENT_CARD_LOOK).map(
      (l) => `${l.sign}:${l.n ?? ''}`,
    );
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
  it('пара — сущность pair, терапевт — небо и Talk, знаки есть на canvas', () => {
    expect(INVITE_LOOK.pair).toEqual({
      hue: ENTITY_LOOK.pair.hue,
      sign: ENTITY_LOOK.pair.sign,
    });
    expect(INVITE_LOOK.therapist).toEqual({ hue: 240, sign: 'talk' });
    for (const l of Object.values(INVITE_LOOK))
      expect(canvasSign(l.sign)).toBe(l.sign);
  });
});
