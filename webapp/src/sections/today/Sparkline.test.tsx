// @vitest-environment jsdom
// Sparkline — мини-график динамики на экране «Сегодня» (0% покрытия).
// Проверяем: меньше двух точек — пустая заглушка без падения (не пытаемся
// строить путь из одной точки), а два+ значения дают валидный SVG path.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Sparkline } from './Sparkline';

afterEach(() => {
  cleanup();
});

describe('Sparkline', () => {
  it('меньше двух значений — рендерит пустой плейсхолдер без <svg>', () => {
    const { container } = render(<Sparkline values={[5]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('пустой массив тоже не падает', () => {
    expect(() => render(<Sparkline values={[]} />)).not.toThrow();
  });

  it('два и более значений строят SVG path с координатами', () => {
    const { container } = render(<Sparkline values={[2, 8, 5, 9]} />);
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    expect(path!.getAttribute('d')).toMatch(/^M0\.0,/);
  });
});
