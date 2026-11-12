import { describe, it, expect } from 'vitest';
import { DATA_KIND_ENTITY, ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { TABLE_LABELS } from '../../utils/mergeLabels';
import { DATA_KIND_SIGN_LIT, dataKindSign } from './dataKindSign';

// Правило №4: литеральная таблица страницы обязана совпадать с shared (DATA_KIND_ENTITY → ENTITY_LOOK).
describe('dataKindSign — вид данных → знак строки «что переедет»', () => {
  it('совпадает с DATA_KIND_ENTITY и ENTITY_LOOK из shared', () => {
    const expected = Object.fromEntries(
      Object.entries(DATA_KIND_ENTITY).map(([t, id]) => [t, ENTITY_LOOK[id].sign]),
    );
    expect(DATA_KIND_SIGN_LIT).toEqual(expected);
  });

  it('у каждой таблицы, которую сервер отдаёт в сводке (TABLE_LABELS), есть знак', () => {
    for (const t of Object.keys(TABLE_LABELS)) expect(dataKindSign(t), t).not.toBeNull();
  });

  it('опоры брифа: трекер, дневники, схемы и YSQ, режимы, задания, «Мой путь», терапевт', () => {
    expect(dataKindSign('Rating')).toBe('strokes');
    expect(dataKindSign('SchemaDiaryEntry')).toBe('pebbles');
    expect(dataKindSign('YsqResult')).toBe('layers');
    expect(dataKindSign('UserModeNote')).toBe('cluster');
    expect(dataKindSign('UserTask')).toBe('check');
    expect(dataKindSign('AppActivity')).toBe('sheets');
    expect(dataKindSign('TherapyRelation')).toBe('talk');
  });

  it('незнакомая таблица и ключи прототипа — без знака', () => {
    expect(dataKindSign('SomethingNew')).toBeNull();
    expect(dataKindSign('toString')).toBeNull();
  });
});
