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
import { canvasSign } from './signs';

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
  it('= ACHIEVEMENT_LOOK значка в профиле (оттенок и знак)', () => {
    expect(ACHIEVEMENT_CARD_LOOK).toEqual(ACHIEVEMENT_LOOK);
  });

  it.each(Object.entries(ACHIEVEMENT_LOOK))(
    'у достижения %s есть знак на canvas',
    (_id, look) => {
      expect(canvasSign(look.sign)).toBe(look.sign);
    },
  );

  it('незнакомое достижение — без знака', () => {
    expect(achievementCardLook('streak_7')).toEqual({
      hue: 70,
      sign: 'strokes',
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
