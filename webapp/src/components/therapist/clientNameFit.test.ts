import { describe, it, expect } from 'vitest';
import { clientNameClass } from './clientNameFit';

const LONG = 'ds-h3 tk-name tk-name--long';

describe('clientNameFit', () => {
  it('обычное имя — без модификатора', () => {
    expect(clientNameClass('Игорь Валентинович Преображенский')).toBe('ds-h2 tk-name');
    expect(clientNameClass('Анна Соколова')).toBe('ds-h2 tk-name');
  });

  it('длинное имя — tk-name--long; пробелы по краям не считаются', () => {
    expect(clientNameClass('Константин Константинопольский-Задунайский')).toBe('ds-h3 tk-name tk-name--long');
    expect(clientNameClass(`  ${'а'.repeat(40)}  `)).toBe('ds-h2 tk-name');
    expect(clientNameClass('а'.repeat(41))).toBe(LONG);
  });
});
