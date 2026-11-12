// Вид сущностей на карточках шаринга = ENTITY_LOOK (правило №4): литералы рядом с китом
// (обход ловушки чанков) не расходятся с таблицей вида; каждый знак карточки есть в canvas.
import { describe, it, expect } from 'vitest';
import { CARD_LOOK } from './cardLook';
import { ENTITY_LOOK } from '../../theme/entityLook';
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
