// Вид режима по id (modeLookById) и знаки цепочки без повторов (uniqueModeLooks): экраны дневника
// режимов берут бумагу и знак группы из одной таблицы (MODE_GROUP_HUE, MODE_GROUP_SIGN), а не
// цветную точку; «Сердитый Ребёнок» — свой знак (решение 6, APP_2026-11.md).
import { describe, it, expect } from 'vitest';
import { modeLookById, uniqueModeLooks } from './modeLookById';
import { ENTITY_LOOK, MODE_GROUP_SIGN } from '../../../../shared/src/theme/entityLook';
import { MODE_GROUP_HUE } from '../../../../shared/src/theme/entityHue';

describe('modeLookById', () => {
  it('режим группы — бумага и знак своей группы', () => {
    expect(modeLookById('punitive_critic')).toEqual({ hue: MODE_GROUP_HUE.critic, sign: MODE_GROUP_SIGN.critic });
    expect(modeLookById('vulnerable_child')).toEqual({ hue: MODE_GROUP_HUE.child, sign: MODE_GROUP_SIGN.child });
  });

  it('«Сердитый Ребёнок» — свой знак Flare на бумаге детских режимов', () => {
    expect(modeLookById('angry_child')).toEqual({ hue: MODE_GROUP_HUE.child, sign: 'flare' });
  });

  it('неизвестный режим — небо режимов и общий знак, без выдуманной группы', () => {
    expect(modeLookById('no_such_mode')).toEqual({ hue: ENTITY_LOOK.modes.hue, sign: 'cluster' });
  });
});

describe('uniqueModeLooks', () => {
  it('три детских режима — один знак группы, порядок первого появления', () => {
    const looks = uniqueModeLooks(['vulnerable_child', 'lonely_child', 'punitive_critic', 'abandoned_child']);
    expect(looks).toEqual([modeLookById('vulnerable_child'), modeLookById('punitive_critic')]);
  });

  it('свой знак внутри группы не сливается со знаком группы', () => {
    expect(uniqueModeLooks(['vulnerable_child', 'angry_child'])).toHaveLength(2);
  });

  it('пусто → пусто', () => {
    expect(uniqueModeLooks([])).toEqual([]);
  });
});
