// @vitest-environment jsdom
// Иконка «поделиться» — единственная копия для кнопок шаринга обоих
// фронтендов. Проверяем размер по умолчанию и переопределение через size.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ShareIcon } from './ShareIcon';

afterEach(() => {
  cleanup();
});

describe('ShareIcon', () => {
  it('размер по умолчанию — 16', () => {
    const { container } = render(<ShareIcon />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
  });

  it('размер переопределяется пропом', () => {
    const { container } = render(<ShareIcon size={24} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('24');
  });
});
