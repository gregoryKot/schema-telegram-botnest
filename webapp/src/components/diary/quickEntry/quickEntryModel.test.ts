import { describe, it, expect } from 'vitest';
import {
  QUICK_TAGS, GRATITUDE_MAX_ITEMS, appendGratitudeItem, hasSecondStep, mergeInitialItem, modeEntryInput, schemaEntryInput,
} from './quickEntryModel';

describe('quickEntryModel', () => {
  it('четыре тега в порядке экрана, «Просто мысль» первым', () => {
    expect(QUICK_TAGS.map((t) => t.label)).toEqual(['Просто мысль', 'Схема', 'Режим', 'Благодарность']);
    expect(QUICK_TAGS[0].id).toBe('thought');
  });

  it('второй экран только у схемы и режима', () => {
    expect(QUICK_TAGS.filter((t) => hasSecondStep(t.id)).map((t) => t.id)).toEqual(['schema', 'mode']);
  });

  it('мысль — запись схем без схем и эмоций, текст обрезан по краям', () => {
    expect(schemaEntryInput('  Опять промолчал ')).toEqual({ trigger: 'Опять промолчал', emotions: [], schemaIds: [] });
    expect(schemaEntryInput('x', ['abandonment']).schemaIds).toEqual(['abandonment']);
  });

  it('режим — только modeId и ситуация, остальные поля не уходят', () => {
    expect(modeEntryInput(' Сорвался ', 'vulnerable_child')).toEqual({ modeId: 'vulnerable_child', situation: 'Сорвался' });
  });

  describe('appendGratitudeItem', () => {
    it('дописывает пункт к сегодняшним, пустые пункты отбрасывает', () => {
      expect(appendGratitudeItem(['Чай', ''], ' Солнце ')).toEqual(['Чай', 'Солнце']);
      expect(appendGratitudeItem([], 'Солнце')).toEqual(['Солнце']);
    });
    it('пять пунктов уже есть — null (места нет)', () => {
      expect(appendGratitudeItem(Array(GRATITUDE_MAX_ITEMS).fill('а'), 'шестой')).toBeNull();
    });
    it('четыре пункта — ещё один влезает', () => {
      expect(appendGratitudeItem(['а', 'б', 'в', 'г'], 'д')).toHaveLength(5);
    });
  });

  describe('mergeInitialItem', () => {
    it('встаёт в первый пустой пункт', () => {
      expect(mergeInitialItem(['Чай', '', ''], 'Солнце')).toEqual(['Чай', 'Солнце', '']);
    });
    it('пустых нет — новым пунктом, пока их меньше пяти', () => {
      expect(mergeInitialItem(['а', 'б', 'в'], 'г')).toEqual(['а', 'б', 'в', 'г']);
      expect(mergeInitialItem(['а', 'б', 'в', 'г', 'д'], 'е')).toEqual(['а', 'б', 'в', 'г', 'д']);
    });
    it('такой пункт уже есть или текст пуст — без изменений', () => {
      expect(mergeInitialItem(['Чай', ''], 'Чай')).toEqual(['Чай', '']);
      expect(mergeInitialItem(['Чай', ''], '  ')).toEqual(['Чай', '']);
    });
  });
});
