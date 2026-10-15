import { describe, expect, it } from 'vitest';
import { edgeLabelStyle } from './edgeLabel';

describe('edgeLabelStyle', () => {
  it('обычная подпись — серая плашка, labelStyle ребра поверх', () => {
    const s = edgeLabelStyle('активирует', 'var(--accent-red)', { fontSize: 12 });
    expect(s.color).toBe('var(--text-sub)');
    expect(s.fontSize).toBe(12);
    expect(s.borderRadius).toBe('var(--r-6)');
  });

  it('✗ — круглый значок цвета линии', () => {
    const s = edgeLabelStyle('✗', 'var(--accent-red)', { fontSize: 11 });
    expect(s.color).toBe('var(--accent-red)');
    expect(s.borderRadius).toBe(999);
    expect(s.fontSize).toBe(14);
    expect(String(s.border)).toContain('var(--accent-red)');
  });

  it('✓ — тоже значок, пробелы вокруг не мешают', () => {
    expect(edgeLabelStyle(' ✓ ', 'var(--accent-green)').color).toBe('var(--accent-green)');
  });

  it('без цвета линии значка нет — обычная плашка', () => {
    expect(edgeLabelStyle('✗', undefined).color).toBe('var(--text-sub)');
  });
});
