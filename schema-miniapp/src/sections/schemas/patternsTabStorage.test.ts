// @vitest-environment jsdom
// Чистое чтение/запись последней вкладки «Паттернов» — интеграционный сценарий
// (restore/override/garbage) уже покрыт SchemasSection.test.tsx; здесь —
// только сама функция парсинга, включая случаи, которые собрать через полный
// рендер секции неудобно (null-ключ, посторонний JSON-мусор).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readStoredPatternsTab,
  writeStoredPatternsTab,
} from './patternsTabStorage';

beforeEach(() => localStorage.clear());

describe('readStoredPatternsTab', () => {
  it('ключа нет — null', () => {
    expect(readStoredPatternsTab()).toBeNull();
  });

  it('валидное значение каждой из трёх вкладок проходит', () => {
    for (const tab of ['schemas', 'modes', 'needs'] as const) {
      localStorage.setItem('patterns_last_tab', tab);
      expect(readStoredPatternsTab()).toBe(tab);
    }
  });

  it('чужой/битый id — null, не бросает', () => {
    localStorage.setItem('patterns_last_tab', 'мусор');
    expect(readStoredPatternsTab()).toBeNull();
  });
});

describe('writeStoredPatternsTab', () => {
  it('пишет ровно переданную вкладку (read-after-write)', () => {
    writeStoredPatternsTab('modes');
    expect(localStorage.getItem('patterns_last_tab')).toBe('modes');
    expect(readStoredPatternsTab()).toBe('modes');
  });
});
