// @vitest-environment jsdom
// Sparkline-компоненты кабинета терапевта (правило №3) — поведение (что
// рисуется/не рисуется в зависимости от данных), не разметка.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { RosterSparkline, ClientSparkline } from './Sparklines';

afterEach(() => {
  cleanup();
});

describe('RosterSparkline', () => {
  it('меньше двух значений → пустой svg без path/circle', () => {
    const { container } = render(<RosterSparkline values={[5]} />);
    expect(container.querySelector('path')).toBeNull();
    expect(container.querySelector('circle')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('достаточно данных → рисует path и точку последнего значения', () => {
    const { container } = render(<RosterSparkline values={[3, 5, 7, 8, 9]} />);
    expect(container.querySelector('path')).toBeTruthy();
    expect(container.querySelector('circle')).toBeTruthy();
  });

  it('null-значения в хвосте фильтруются, но не ломают рендер', () => {
    const { container } = render(
      <RosterSparkline values={[3, null, 5, null, 7]} />,
    );
    expect(container.querySelector('path')).toBeTruthy();
  });

  it('cвежее значение ≥7 — зелёный цвет линии', () => {
    const { container } = render(<RosterSparkline values={[2, 4, 8]} />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('stroke')).toBe('#06d6a0');
  });

  it('свежее значение <4 — красный акцент', () => {
    const { container } = render(<RosterSparkline values={[8, 6, 2]} />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('stroke')).toBe('var(--accent-red)');
  });
});

describe('ClientSparkline', () => {
  it('меньше двух точек → рендерит null (пусто)', () => {
    const { container } = render(
      <ClientSparkline values={[5]} color="#a78bfa" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('достаточно данных → polyline и точка', () => {
    const { container } = render(
      <ClientSparkline values={[1, 4, 2, 8]} color="#a78bfa" />,
    );
    expect(container.querySelector('polyline')).toBeTruthy();
    expect(container.querySelector('circle')).toBeTruthy();
  });
});
