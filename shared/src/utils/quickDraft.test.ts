// @vitest-environment jsdom
// Черновик «Дневника одной страницей» в localStorage: сохранил → перечитал,
// очистка после отправки, недоступное хранилище не роняет экран.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveDraft, loadDraft } from './drafts';
import {
  QUICK_DRAFT_KEY,
  saveQuickDraft,
  loadQuickDraft,
  clearQuickDraft,
} from './quickDraft';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('черновик «Дневника одной страницей»', () => {
  it('сохранил → перечитал: тот же текст, под ключом diary_draft_quick', () => {
    saveQuickDraft('Опять промолчал на встрече');
    expect(loadQuickDraft()).toBe('Опять промолчал на встрече');
    expect(localStorage.getItem(QUICK_DRAFT_KEY)).toBe(
      'Опять промолчал на встрече',
    );
    expect(QUICK_DRAFT_KEY).toBe('diary_draft_quick');
  });

  it('пустой или из пробелов текст стирает черновик, а не хранит пустоту', () => {
    saveQuickDraft('что-то');
    saveQuickDraft('   ');
    expect(loadQuickDraft()).toBe('');
    expect(localStorage.getItem(QUICK_DRAFT_KEY)).toBeNull();
  });

  it('clearQuickDraft очищает; черновики мастеров не затрагиваются', () => {
    saveDraft('schema', { trigger: 'x' });
    saveQuickDraft('текст');
    clearQuickDraft();
    expect(loadQuickDraft()).toBe('');
    expect(loadDraft('schema')?.data).toEqual({ trigger: 'x' });
  });

  it('localStorage недоступен: чтение — пустая строка, запись и очистка не бросают', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadQuickDraft()).toBe('');
    expect(() => saveQuickDraft('текст')).not.toThrow();
    expect(() => clearQuickDraft()).not.toThrow();
  });
});
