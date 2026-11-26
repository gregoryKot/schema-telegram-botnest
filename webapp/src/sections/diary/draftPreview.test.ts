import { describe, it, expect } from 'vitest';
import { draftPreview } from './diaryModel';

describe('draftPreview', () => {
  it('берёт триггер, ситуацию или первый пункт по типу', () => {
    expect(draftPreview('schema', { trigger: 'Т' })).toBe('Т');
    expect(draftPreview('mode', { situation: 'С' })).toBe('С');
    expect(draftPreview('gratitude', { items: ['П', 'Q'] })).toBe('П');
  });
  it('пустой или битый черновик даёт пустую строку и режет длинное', () => {
    expect(draftPreview('schema', undefined)).toBe('');
    expect(draftPreview('gratitude', { items: [] })).toBe('');
    expect(draftPreview('mode', { situation: 'x'.repeat(300) }).length).toBe(100);
  });
});
