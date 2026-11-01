// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConceptToggleChip } from './ConceptToggleChip';

afterEach(() => cleanup());

describe('ConceptToggleChip', () => {
  it('по умолчанию — кнопка-переключатель', () => {
    const onClick = vi.fn();
    render(
      <ConceptToggleChip
        label="Карающий Критик"
        color="var(--accent)"
        active
        onClick={onClick}
      />,
    );
    const btn = screen.getByRole('button', { name: /Карающий Критик/ });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('readOnly — просто подпись: не кнопка, название на месте', () => {
    render(
      <ConceptToggleChip
        label="Карающий Критик"
        color="var(--accent)"
        active
        readOnly
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/Карающий Критик/)).toBeTruthy();
  });
});
