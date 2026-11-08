// Разбор ответа merge/preview (S20): на экран — только известная форма.
import { describe, it, expect } from 'vitest';
import { parseMergePreview } from './useMergePreview';

describe('parseMergePreview', () => {
  it('известная форма проходит как есть', () => {
    expect(parseMergePreview({ provider: 'vk', otherDisplay: 'Аня', summary: { Rating: 3 }, twoFactorLost: true }))
      .toEqual({ provider: 'vk', otherDisplay: 'Аня', summary: { Rating: 3 }, twoFactorLost: true });
  });

  it('в сводке — только положительные числа; пустое имя — null; 2FA — только true', () => {
    expect(parseMergePreview({ provider: 'vk', otherDisplay: '', summary: { Rating: 3, Note: '7', X: -1, Y: Infinity }, twoFactorLost: 'yes' }))
      .toEqual({ provider: 'vk', otherDisplay: null, summary: { Rating: 3 }, twoFactorLost: false });
  });

  it('чужая форма — null (экран скажет нейтрально)', () => {
    expect(parseMergePreview(null)).toBeNull();
    expect(parseMergePreview({ message: 'Forbidden' })).toBeNull();
    expect(parseMergePreview({ provider: 'vk' })).toBeNull();
  });
});
