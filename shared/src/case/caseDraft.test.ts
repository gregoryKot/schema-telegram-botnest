// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveCaseDraft, loadCaseDraft, clearCaseDraft } from './caseDraft';
import { INITIAL_CASE_FIELDS } from './caseFlowTypes';

beforeEach(() => {
  localStorage.clear();
});

describe('caseDraft — сохранил → нашёл (read-after-write)', () => {
  it('пустого хранилища читается как null, а не бросает', () => {
    expect(loadCaseDraft()).toBeNull();
  });

  it('сохранённый черновик читается обратно с тем же шагом и полями', () => {
    saveCaseDraft({ ...INITIAL_CASE_FIELDS, step: 'scene', scene: 'коротко' });
    const loaded = loadCaseDraft();
    expect(loaded?.step).toBe('scene');
    expect(loaded?.scene).toBe('коротко');
  });

  it('clearCaseDraft убирает черновик — следующий load снова null', () => {
    saveCaseDraft({ ...INITIAL_CASE_FIELDS, step: 'body' });
    clearCaseDraft();
    expect(loadCaseDraft()).toBeNull();
  });

  it('битый JSON в хранилище не бросает — load возвращает null', () => {
    localStorage.setItem('diary_draft_case', '{не json');
    expect(loadCaseDraft()).toBeNull();
  });
});

// Отказ хранилища (приватный режим, переполненная квота) — реальный сценарий,
// не теоретический (см. комментарий-шапку caseDraft.ts, правило №14 CLAUDE.md
// про молчащую аварию). save/clear ловят исключение и логируют его, а не
// роняют поток разбора — эти два catch и проверяем здесь.
describe('caseDraft — сбой localStorage не роняет поток, но и не молчит', () => {
  it('save: setItem бросает — исключение поймано, ошибка залогирована', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    try {
      expect(() =>
        saveCaseDraft({ ...INITIAL_CASE_FIELDS, step: 'scene' }),
      ).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'case draft save failed',
        expect.any(Error),
      );
    } finally {
      setItemSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('clear: removeItem бросает — исключение поймано, ошибка залогирована', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('removeItem failed');
      });
    try {
      expect(() => clearCaseDraft()).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'case draft clear failed',
        expect.any(Error),
      );
    } finally {
      removeItemSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
