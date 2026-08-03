// @vitest-environment jsdom
// Черновики дневника в localStorage. Правило read-after-write (CLAUDE.md):
// сохранил → перечитал → тот же текст; и очистка после отправки — иначе
// «черновик сохранился» зелёное, а на экране пользователь его не находит.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DRAFT_KEYS,
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
  formatDraftAge,
} from './drafts';

beforeEach(() => {
  localStorage.clear();
});

describe('saveDraft → loadDraft (read-after-write)', () => {
  it('сохранённые данные читаются обратно теми же значениями', () => {
    saveDraft('schema', { trigger: 'Ситуация', schemaIds: ['abandonment'] });
    const loaded = loadDraft<{ trigger: string; schemaIds: string[] }>('schema');
    expect(loaded?.data).toEqual({
      trigger: 'Ситуация',
      schemaIds: ['abandonment'],
    });
    expect(typeof loaded?.startedAt).toBe('string');
  });

  it('разные типы дневника хранятся под своими ключами и не смешиваются', () => {
    saveDraft('schema', { a: 1 });
    saveDraft('mode', { b: 2 });
    expect(loadDraft('schema')?.data).toEqual({ a: 1 });
    expect(loadDraft('mode')?.data).toEqual({ b: 2 });
    expect(localStorage.getItem(DRAFT_KEYS.schema)).not.toBeNull();
    expect(localStorage.getItem(DRAFT_KEYS.gratitude)).toBeNull();
  });

  it('без сохранённого черновика — null, не падение', () => {
    expect(loadDraft('gratitude')).toBeNull();
  });

  it('битый JSON в сторадже — null вместо падения (best-effort)', () => {
    localStorage.setItem(DRAFT_KEYS.mode, '{не json');
    expect(loadDraft('mode')).toBeNull();
  });
});

describe('clearDraft / hasDraft', () => {
  it('после очистки черновика нет и hasDraft возвращает false', () => {
    saveDraft('gratitude', { items: ['a'] });
    expect(hasDraft('gratitude')).toBe(true);
    clearDraft('gratitude');
    expect(hasDraft('gratitude')).toBe(false);
    expect(loadDraft('gratitude')).toBeNull();
  });

  it('hasDraft false на чистом аккаунте (нет черновика вообще)', () => {
    expect(hasDraft('schema')).toBe(false);
  });
});

describe('saveDraft — best-effort при недоступном localStorage', () => {
  it('исключение setItem проглатывается, не роняет вызывающий код', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });
    expect(() => saveDraft('schema', { a: 1 })).not.toThrow();
    spy.mockRestore();
  });
});

describe('formatDraftAge', () => {
  it('только что (меньше минуты)', () => {
    expect(formatDraftAge(new Date(Date.now() - 5_000).toISOString())).toBe(
      'только что',
    );
  });

  it('минуты — без склонения', () => {
    expect(
      formatDraftAge(new Date(Date.now() - 5 * 60_000).toISOString()),
    ).toBe('5 мин. назад');
  });

  it('часы: склонение 1/2-4/5+', () => {
    const hoursAgo = (h: number) =>
      formatDraftAge(new Date(Date.now() - h * 3_600_000).toISOString());
    expect(hoursAgo(1)).toBe('1 час назад');
    expect(hoursAgo(3)).toBe('3 часа назад');
    expect(hoursAgo(5)).toBe('5 часов назад');
  });

  it('дни: склонение 1/2-4/5+', () => {
    const daysAgo = (d: number) =>
      formatDraftAge(new Date(Date.now() - d * 86_400_000).toISOString());
    expect(daysAgo(1)).toBe('1 день назад');
    expect(daysAgo(3)).toBe('3 дня назад');
    expect(daysAgo(7)).toBe('7 дней назад');
  });
});
