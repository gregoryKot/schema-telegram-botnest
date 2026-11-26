import { describe, it, expect } from 'vitest';
import { DATA_KIND_ENTITY, ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { TABLE_LABELS } from '../../utils/mergeLabels';
import { dataKindSign } from './dataKindSign';

describe('dataKindSign — вид данных → знак строки «что переедет»', () => {
  it('знак таблицы — знак её сущности (DATA_KIND_ENTITY → ENTITY_LOOK)', () => {
    for (const [t, id] of Object.entries(DATA_KIND_ENTITY)) expect(dataKindSign(t), t).toBe(ENTITY_LOOK[id].sign);
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
