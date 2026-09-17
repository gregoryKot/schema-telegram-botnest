// @vitest-environment jsdom
// loadLocal/fmtDate — общее хранилище проверок убеждений (localStorage).
// Тест ловит: битый JSON в localStorage не должен ронять приложение
// (правило «пусто, а не мусор»), и что дата форматируется по-русски.
import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_KEY, fmtDate, loadLocal, type BeliefEntry } from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('loadLocal', () => {
  it('на чистом localStorage возвращает пустой массив, а не ошибку', () => {
    expect(loadLocal()).toEqual([]);
  });

  it('читает ранее сохранённые записи (read-after-write)', () => {
    const entry: BeliefEntry = {
      id: '1',
      date: '3 августа',
      belief: 'я всегда всё порчу',
      for: ['пример'],
      against: ['контрпример'],
      reframe: 'иногда ошибаюсь',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry]));
    expect(loadLocal()).toEqual([entry]);
  });

  it('битый JSON не роняет чтение — возвращает пустой массив', () => {
    localStorage.setItem(STORAGE_KEY, '{не json');
    expect(loadLocal()).toEqual([]);
  });
});

describe('fmtDate', () => {
  it('форматирует ISO-дату в русский формат «день месяц»', () => {
    const result = fmtDate('2026-08-03T00:00:00.000Z');
    expect(result).toMatch(/августа/);
  });
});
