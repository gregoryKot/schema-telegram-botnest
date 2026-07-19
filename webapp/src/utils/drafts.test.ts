// @vitest-environment jsdom
// Тест черновиков дневника (drafts.ts — ПАРНЫЙ файл, побайтово совпадает с
// schema-miniapp/src/utils/drafts.ts, см. scripts/check-paired-files.mjs).
// Тест лежит только в webapp, но защищает и копию в мини-аппе транзитивно —
// парный чекер в CI роняет сборку при расхождении файлов.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveDraft, loadDraft, clearDraft, hasDraft, formatDraftAge, DRAFT_KEYS } from './drafts';
import type { DiaryType } from '../types';

const TYPES: DiaryType[] = ['schema', 'mode', 'gratitude'];

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-17T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('saveDraft / loadDraft / clearDraft / hasDraft', () => {
  it('сохраняет и читает черновик по каждому ключу дневника отдельно', () => {
    for (const type of TYPES) {
      expect(hasDraft(type)).toBe(false);
      saveDraft(type, { text: `draft-${type}` });
    }
    for (const type of TYPES) {
      expect(hasDraft(type)).toBe(true);
      const loaded = loadDraft<{ text: string }>(type);
      expect(loaded?.data).toEqual({ text: `draft-${type}` });
      expect(loaded?.startedAt).toBe('2026-07-17T12:00:00.000Z');
    }
  });

  it('черновики разных типов не пересекаются (разные ключи localStorage)', () => {
    saveDraft('schema', { a: 1 });
    saveDraft('mode', { a: 2 });
    expect(loadDraft<{ a: number }>('schema')?.data).toEqual({ a: 1 });
    expect(loadDraft<{ a: number }>('mode')?.data).toEqual({ a: 2 });
    expect(hasDraft('gratitude')).toBe(false);
  });

  it('перезаписывает черновик того же типа при повторном saveDraft', () => {
    saveDraft('schema', { v: 1 });
    saveDraft('schema', { v: 2 });
    expect(loadDraft<{ v: number }>('schema')?.data).toEqual({ v: 2 });
  });

  it('loadDraft для отсутствующего черновика возвращает null', () => {
    expect(loadDraft('schema')).toBeNull();
  });

  it('clearDraft удаляет только свой ключ', () => {
    saveDraft('schema', { x: 1 });
    saveDraft('mode', { x: 2 });
    clearDraft('schema');
    expect(hasDraft('schema')).toBe(false);
    expect(hasDraft('mode')).toBe(true);
  });

  it('DRAFT_KEYS содержит уникальный ключ на каждый тип', () => {
    const keys = Object.values(DRAFT_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('битый JSON в localStorage не бросает — loadDraft возвращает null', () => {
    localStorage.setItem(DRAFT_KEYS.schema, '{не валидный json');
    expect(() => loadDraft('schema')).not.toThrow();
    expect(loadDraft('schema')).toBeNull();
  });

  it('saveDraft не бросает, если localStorage.setItem бросает (quota exceeded и т.п.)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveDraft('schema', { x: 1 })).not.toThrow();
    spy.mockRestore();
  });
});

describe('formatDraftAge', () => {
  const iso = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('только что — младше минуты', () => {
    expect(formatDraftAge(iso(30_000))).toBe('только что');
    expect(formatDraftAge(iso(0))).toBe('только что');
  });

  it('минуты — без плюрализации', () => {
    expect(formatDraftAge(iso(60_000))).toBe('1 мин. назад');
    expect(formatDraftAge(iso(45 * 60_000))).toBe('45 мин. назад');
  });

  it('часы — плюрализация 1/2-4/5+', () => {
    expect(formatDraftAge(iso(3_600_000))).toBe('1 час назад');
    expect(formatDraftAge(iso(2 * 3_600_000))).toBe('2 часа назад');
    expect(formatDraftAge(iso(4 * 3_600_000))).toBe('4 часа назад');
    expect(formatDraftAge(iso(5 * 3_600_000))).toBe('5 часов назад');
    expect(formatDraftAge(iso(20 * 3_600_000))).toBe('20 часов назад');
  });

  it('дни — плюрализация 1/2-4/5+', () => {
    expect(formatDraftAge(iso(86_400_000))).toBe('1 день назад');
    expect(formatDraftAge(iso(2 * 86_400_000))).toBe('2 дня назад');
    expect(formatDraftAge(iso(4 * 86_400_000))).toBe('4 дня назад');
    expect(formatDraftAge(iso(5 * 86_400_000))).toBe('5 дней назад');
    expect(formatDraftAge(iso(10 * 86_400_000))).toBe('10 дней назад');
  });

  it('дни имеют приоритет над часами, часы — над минутами', () => {
    // 25 часов = 1 день 1 час → должно показать дни, а не часы.
    expect(formatDraftAge(iso(25 * 3_600_000))).toBe('1 день назад');
    // 90 минут = 1.5 часа → должно показать часы, а не минуты.
    expect(formatDraftAge(iso(90 * 60_000))).toBe('1 час назад');
  });
});
