// Названия таблиц для экранов переноса данных. Список общий у двух экранов —
// тест держит то, ради чего его вынесли: незнакомое имя не превращается в
// пустоту, а сумма считается по всем строкам.
import { describe, it, expect } from 'vitest';
import { TABLE_LABELS, tableLabel, totalItems } from './mergeLabels';

describe('tableLabel', () => {
  it('переводит известные таблицы на человеческий', () => {
    expect(tableLabel('Rating')).toBe('оценки потребностей');
    expect(tableLabel('UserLetter')).toBe('письма себе');
  });

  it('незнакомую таблицу показывает как есть, а не прячет', () => {
    expect(tableLabel('SomethingNew')).toBe('SomethingNew');
  });

  it('в списке нет пустых названий — иначе строка сводки будет безымянной', () => {
    for (const [table, label] of Object.entries(TABLE_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
      expect(label).not.toBe(table);
    }
  });
});

describe('totalItems', () => {
  it('складывает всё, что переедет', () => {
    expect(totalItems({ Rating: 12, Note: 3 })).toBe(15);
  });

  it('переносить нечего — ноль, а не NaN', () => {
    expect(totalItems({})).toBe(0);
  });
});
