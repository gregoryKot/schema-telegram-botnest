// Разбор ответа merge/preview (S20): на экран — только известная форма.
import { describe, it, expect } from 'vitest';
import { parseMergePreview } from './useMergePreview';

describe('parseMergePreview', () => {
  it('известная форма проходит как есть', () => {
    expect(parseMergePreview({ provider: 'vk', otherDisplay: 'Аня', summary: { Rating: 3 }, combined: 2, lost: { Rating: 1 }, twoFactorLost: true }))
      .toEqual({ provider: 'vk', otherDisplay: 'Аня', summary: { Rating: 3 }, combined: 2, lost: { Rating: 1 }, twoFactorLost: true });
  });

  it('в сводке — только положительные числа; пустое имя — null; 2FA — только true', () => {
    expect(parseMergePreview({ provider: 'vk', otherDisplay: '', summary: { Rating: 3, Note: '7', X: -1, Y: Infinity }, twoFactorLost: 'yes' }))
      .toEqual({ provider: 'vk', otherDisplay: null, summary: { Rating: 3 }, combined: 0, lost: {}, twoFactorLost: false });
  });

  it('combined (R3) — только конечное положительное число, иначе 0', () => {
    const base = { provider: 'vk', summary: {} };
    expect(parseMergePreview({ ...base, combined: 3 })?.combined).toBe(3);
    for (const bad of ['3', -1, Infinity, NaN, undefined]) {
      expect(parseMergePreview({ ...base, combined: bad })?.combined).toBe(0);
    }
  });

  it('lost — как summary: только конечные положительные числа; нет поля или не объект — {}', () => {
    const base = { provider: 'vk', summary: {} };
    expect(parseMergePreview({ ...base, lost: { Rating: 2, YsqProgress: '1', X: 0, Y: NaN, Z: Infinity } })?.lost).toEqual({ Rating: 2 });
    for (const bad of [undefined, null, 'Rating', 3]) {
      expect(parseMergePreview({ ...base, lost: bad })?.lost).toEqual({});
    }
  });

  it('чужая форма — null (экран скажет нейтрально)', () => {
    expect(parseMergePreview(null)).toBeNull();
    expect(parseMergePreview({ message: 'Forbidden' })).toBeNull();
    expect(parseMergePreview({ provider: 'vk' })).toBeNull();
  });
});
