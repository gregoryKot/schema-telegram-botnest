// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { pushRecent, readRecent, RECENT_LIMIT } from './paletteRecent';

beforeEach(() => localStorage.clear());

describe('paletteRecent', () => {
  it('свежие первыми; повтор поднимается наверх без дубля', () => {
    for (const key of ['section:today', 'client:7', 'section:today']) pushRecent(key);
    expect(readRecent()).toEqual(['section:today', 'client:7']);
  });

  it('хранит не больше предела — старые уходят', () => {
    for (let i = 0; i < RECENT_LIMIT + 2; i++) pushRecent(`client:${i}`);
    expect(readRecent()).toEqual(['client:6', 'client:5', 'client:4', 'client:3', 'client:2']);
  });

  it('битый JSON, не массив и не строки — пусто или только строки; запись после этого работает', () => {
    localStorage.setItem('search_recent', '{не json');
    expect(readRecent()).toEqual([]);
    localStorage.setItem('search_recent', '{"a":1}');
    expect(readRecent()).toEqual([]);
    localStorage.setItem('search_recent', '["client:1", 5, null]');
    expect(readRecent()).toEqual(['client:1']);
    pushRecent('section:diary');
    expect(readRecent()).toEqual(['section:diary', 'client:1']);
  });
});
