// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConceptModePicker } from './ConceptModePicker';

describe('ConceptModePicker', () => {
  it('без фильтра показывает режимы всех групп', () => {
    render(<ConceptModePicker activeModeIds={[]} onToggle={() => {}} />);
    expect(
      screen.getByRole('button', { name: /Уязвимый Ребёнок/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Карающий Критик/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Здоровый Взрослый/ }),
    ).toBeTruthy();
  });

  it('groupIds оставляет только группы клетки', () => {
    render(
      <ConceptModePicker
        activeModeIds={[]}
        onToggle={() => {}}
        groupIds={['critic']}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Карающий Критик/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Уязвимый Ребёнок/ }),
    ).toBeNull();
  });

  it('выбранные режимы видны и помечены, тап снимает/ставит через onToggle', () => {
    const onToggle = vi.fn();
    render(
      <ConceptModePicker
        activeModeIds={['punitive_critic']}
        onToggle={onToggle}
        groupIds={['critic']}
      />,
    );
    const on = screen.getByRole('button', { name: /Карающий Критик/ });
    const off = screen.getByRole('button', { name: /Требовательный Критик/ });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(off.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(on);
    fireEvent.click(off);
    expect(onToggle.mock.calls).toEqual([
      ['punitive_critic'],
      ['demanding_critic'],
    ]);
  });

  it('подложки — color-mix, а не склейка токена с hex-суффиксом (невалидный CSS)', () => {
    const { container } = render(
      <ConceptModePicker
        activeModeIds={['punitive_critic']}
        onToggle={() => {}}
        groupIds={['critic']}
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain('color-mix(in srgb, var(--accent-red)');
    expect(html).not.toMatch(/var\(--[a-z-]+\)[0-9a-f]{2}\b/);
  });
});
