import { describe, it, expect } from 'vitest';
import { ENTITY_LOOK, MODE_GROUP_SIGN } from '../../../../../shared/src/theme/entityLook';
import { QUICK_TAGS, QUICK_TAG_ENTITY } from './quickEntryModel';
import { quickDoneView } from './quickDoneView';

describe('вид тегов быстрой записи', () => {
  it('у каждого тега — сущность ENTITY_LOOK со сценой «готово»', () => {
    for (const t of QUICK_TAGS) {
      const look = ENTITY_LOOK[QUICK_TAG_ENTITY[t.id]];
      expect(look, t.id).toBeTruthy();
      expect(look.done, t.id).not.toBeNull();
    }
  });

  it('мысль — персик быстрой записи, благодарность — своя бумага, а не та же', () => {
    expect(ENTITY_LOOK[QUICK_TAG_ENTITY.thought].hue).toBe(45);
    expect(ENTITY_LOOK[QUICK_TAG_ENTITY.gratitude].hue).not.toBe(ENTITY_LOOK[QUICK_TAG_ENTITY.thought].hue);
  });
});

describe('quickDoneView — лист «Записано» по типу записи', () => {
  it('мысль и схема — сцена своей сущности, без своих данных', () => {
    expect(quickDoneView({ tag: 'thought' })).toEqual({ entity: 'diary' });
    expect(quickDoneView({ tag: 'schema' })).toEqual({ entity: 'diary_schema' });
  });

  it('режим — бумага и знак его группы; «Сердитый Ребёнок» — свой знак', () => {
    expect(quickDoneView({ tag: 'mode', modeId: 'punitive_critic' })).toEqual({
      entity: 'diary_mode', hue: 310, sprout: MODE_GROUP_SIGN.critic,
    });
    expect(quickDoneView({ tag: 'mode', modeId: 'angry_child' })).toMatchObject({ hue: 28, sprout: 'flare' });
  });

  it('режим без id (мастер) — вид дневника режимов по умолчанию', () => {
    expect(quickDoneView({ tag: 'mode' })).toEqual({ entity: 'diary_mode' });
  });

  it('благодарность — легло столько камешков, сколько пунктов за день, не больше трёх', () => {
    expect(quickDoneView({ tag: 'gratitude', gratitudeCount: 1 }).pebbles).toBe(1);
    expect(quickDoneView({ tag: 'gratitude', gratitudeCount: 5 }).pebbles).toBe(3);
    expect(quickDoneView({ tag: 'gratitude' })).toEqual({ entity: 'gratitude' });
  });
});
