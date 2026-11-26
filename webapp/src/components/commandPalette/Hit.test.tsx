// @vitest-environment jsdom
// Подсветка в строке палитры: совпадение — в <mark>, текст строки целиком не меняется.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Hit } from './Hit';

describe('Hit', () => {
  it('совпадение обёрнуто в mark, остальной текст — как был', () => {
    const { container } = render(<Hit text="Режим Критика" query="критиком" />);
    expect(Array.from(container.querySelectorAll('mark.cmd-hit')).map((m) => m.textContent)).toEqual(['Критик']);
    expect(container.textContent).toBe('Режим Критика');
  });

  it('пустой запрос — текст без mark', () => {
    const { container } = render(<Hit text="Режим Критика" query="" />);
    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('Режим Критика');
  });
});
