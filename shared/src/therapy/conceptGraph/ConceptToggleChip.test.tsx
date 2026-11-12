// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConceptToggleChip } from './ConceptToggleChip';
import { withPaper } from './conceptPaper.test-helpers';
import { DOMAIN_HUE } from '../../theme/entityHue';

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

  it('на бумаге сайта: чип сайта (SignChip) получает состояние, знак и бумагу hue; тап зовёт onClick', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      withPaper(
        <ConceptToggleChip
          label="Неуспешность"
          color="x"
          hue={DOMAIN_HUE.rejection}
          sign="need_play"
          active={false}
          onClick={onClick}
        />,
      ),
    );
    const btn = screen.getByRole('button', { name: /Неуспешность/ });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.dataset.hue).toBe(String(DOMAIN_HUE.rejection));
    expect(btn.dataset.chipSign).toBe('need_play');
    expect(btn.getAttribute('style')).toBeNull();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      withPaper(
        <ConceptToggleChip
          label="Неуспешность"
          color="x"
          hue={DOMAIN_HUE.rejection}
          active
        />,
      ),
    );
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('readOnly — белый чип со знаком, не кнопка и без цвета в инлайне', () => {
    render(
      withPaper(
        <ConceptToggleChip
          label="Критика"
          color="x"
          sign="looming"
          active
          readOnly
        />,
      ),
    );
    const tag = screen.getByText('Критика');
    expect(screen.queryByRole('button')).toBeNull();
    expect(tag.className).toBe('cg-tag');
    expect(tag.getAttribute('style')).toBeNull();
    expect(tag.querySelector('[data-sign="looming"]')).toBeTruthy();
  });
});
