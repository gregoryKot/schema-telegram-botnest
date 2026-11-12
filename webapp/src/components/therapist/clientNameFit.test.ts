import { describe, it, expect } from 'vitest';
import { clientNameClass, isLongClientName } from './clientNameFit';

describe('clientNameFit', () => {
  it('обычное имя — без модификатора', () => {
    expect(isLongClientName('Анна Соколова')).toBe(false);
    expect(isLongClientName('Игорь Валентинович Преображенский')).toBe(false);
    expect(clientNameClass('Анна Соколова')).toBe('ds-h2 tk-name');
  });

  it('длинное имя — tk-name--long; пробелы по краям не считаются', () => {
    expect(clientNameClass('Константин Константинопольский-Задунайский')).toBe('ds-h3 tk-name tk-name--long');
    expect(isLongClientName(`  ${'а'.repeat(40)}  `)).toBe(false);
    expect(isLongClientName('а'.repeat(41))).toBe(true);
  });
});
