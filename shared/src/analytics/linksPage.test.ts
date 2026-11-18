import { describe, it, expect } from 'vitest';
import { linksPageFrom } from './linksPage';

describe('linksPageFrom', () => {
  it('метка из списка проходит как есть, регистр и пробелы не мешают', () => {
    expect(linksPageFrom('?utm_source=telegram')).toBe('telegram');
    expect(linksPageFrom('?a=1&utm_source=Instagram')).toBe('instagram');
    expect(linksPageFrom('?utm_source=%20vk%20')).toBe('vk');
  });

  it('чужая метка — other', () => {
    expect(linksPageFrom('?utm_source=facebook')).toBe('other');
    expect(linksPageFrom('?utm_source=telegram2')).toBe('other');
  });

  it('без метки или с пустой — direct', () => {
    expect(linksPageFrom('')).toBe('direct');
    expect(linksPageFrom('?utm_source=')).toBe('direct');
    expect(linksPageFrom('?utm_medium=bio')).toBe('direct');
  });
});
