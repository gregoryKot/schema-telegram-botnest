// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { keepHyphenWords } from './keepHyphenWords';

const html = (t: string) =>
  render(<p>{keepHyphenWords(t)}</p>).container.firstElementChild!;

describe('keepHyphenWords: слово с дефисом в тексте человека не рвётся, знаки — его', () => {
  it('«по-человечески» и «кто-то» — целиком в span без переноса, дефис обычный', () => {
    const p = html('Забыть — по-человечески. Кто-то рядом.');
    const kept = [...p.querySelectorAll('span')].map((s) => s.textContent);
    expect(kept).toEqual(['по-человечески', 'Кто-то']);
    expect(p.textContent).toBe('Забыть — по-человечески. Кто-то рядом.');
    expect(p.textContent).not.toMatch(/[‑⁠]/);
  });
  it('прочие слова с дефисом и текст без них — как есть', () => {
    expect(
      html('северо-запад, бело-синий').querySelectorAll('span'),
    ).toHaveLength(0);
    expect(keepHyphenWords('просто текст')).toBe('просто текст');
  });
});
