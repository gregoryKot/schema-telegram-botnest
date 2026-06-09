import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
  formatDraftAge,
  DRAFT_KEYS,
} from './drafts';

describe('saveDraft / loadDraft', () => {
  it('сохраняет и читает черновик', () => {
    saveDraft('schema', { text: 'привет' });
    expect(loadDraft<{ text: string }>('schema')?.data).toEqual({ text: 'привет' });
  });

  it('пишет startedAt как ISO-строку', () => {
    saveDraft('mode', { x: 1 });
    expect(loadDraft('mode')?.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('каждый тип использует свой ключ', () => {
    saveDraft('schema', { v: 'a' });
    saveDraft('gratitude', { v: 'b' });
    expect(loadDraft<{ v: string }>('schema')?.data.v).toBe('a');
    expect(loadDraft<{ v: string }>('gratitude')?.data.v).toBe('b');
  });

  it('возвращает null, когда черновика нет', () => {
    expect(loadDraft('schema')).toBeNull();
  });

  it('возвращает null при битом JSON', () => {
    localStorage.setItem(DRAFT_KEYS.schema, '{не json');
    expect(loadDraft('schema')).toBeNull();
  });
});

describe('clearDraft / hasDraft', () => {
  it('hasDraft true после сохранения, false после очистки', () => {
    expect(hasDraft('mode')).toBe(false);
    saveDraft('mode', { x: 1 });
    expect(hasDraft('mode')).toBe(true);
    clearDraft('mode');
    expect(hasDraft('mode')).toBe(false);
  });
});

describe('formatDraftAge', () => {
  afterEach(() => vi.useRealTimers());

  function ageOf(ms: number): string {
    vi.useFakeTimers();
    const now = new Date('2026-06-08T12:00:00Z');
    vi.setSystemTime(now);
    return formatDraftAge(new Date(now.getTime() - ms).toISOString());
  }

  it('"только что" для свежего черновика', () => {
    expect(ageOf(10_000)).toBe('только что');
  });

  it('минуты', () => {
    expect(ageOf(5 * 60_000)).toBe('5 мин. назад');
  });

  it('склонение часов', () => {
    expect(ageOf(1 * 3_600_000)).toBe('1 час назад');
    expect(ageOf(2 * 3_600_000)).toBe('2 часа назад');
    expect(ageOf(5 * 3_600_000)).toBe('5 часов назад');
  });

  it('склонение дней', () => {
    expect(ageOf(1 * 86_400_000)).toBe('1 день назад');
    expect(ageOf(2 * 86_400_000)).toBe('2 дня назад');
    expect(ageOf(5 * 86_400_000)).toBe('5 дней назад');
  });
});
