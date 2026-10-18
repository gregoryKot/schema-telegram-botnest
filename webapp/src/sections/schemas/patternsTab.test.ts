// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { visibleBlocks, readStoredTab, writeStoredTab, PATTERNS_TABS } from './patternsTab';
import { PATTERNS_LAST_TAB_KEY } from '../../utils/storageKeys';

describe('visibleBlocks: какой блок в какой вкладке', () => {
  it('десктоп: вкладок нет, виден весь экран при любом значении вкладки', () => {
    for (const t of PATTERNS_TABS) {
      expect(visibleBlocks(t.id, false)).toEqual({ hero: true, schemas: true, modes: true, needs: true });
    }
  });
  it('телефон, «Схемы»: паттерн недели и схемы, без режимов и потребностей', () => {
    expect(visibleBlocks('schemas', true)).toEqual({ hero: true, schemas: true, modes: false, needs: false });
  });
  it('телефон, «Режимы»: только режимы', () => {
    expect(visibleBlocks('modes', true)).toEqual({ hero: false, schemas: false, modes: true, needs: false });
  });
  it('телефон, «Потребности»: только потребности', () => {
    expect(visibleBlocks('needs', true)).toEqual({ hero: false, schemas: false, modes: false, needs: true });
  });
});

describe('запоминание вкладки', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it('пусто или чужое значение — «Схемы»', () => {
    expect(readStoredTab()).toBe('schemas');
    localStorage.setItem(PATTERNS_LAST_TAB_KEY, 'bogus');
    expect(readStoredTab()).toBe('schemas');
  });
  it('записанное читается обратно', () => {
    expect(writeStoredTab('needs')).toBe(true);
    expect(readStoredTab()).toBe('needs');
  });
  it('хранилище бросает — ни чтение, ни запись не падают', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStoredTab()).toBe('schemas');
    expect(writeStoredTab('modes')).toBe(false);
  });
});
