// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
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
