// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConceptToggleChip } from './ConceptToggleChip';
import { ConceptSkinContext, type ConceptSkin } from './conceptSkin';
import { DOMAIN_HUE } from '../../theme/entityHue';

const SKIN: ConceptSkin = {
  seg: { group: 'sk-seg', btn: 'sk-seg-btn' },
  chip: 'sk-chip',
  tag: 'sk-tag',
  dot: 'sk-dot',
  label: 'sk-label',
  link: 'sk-link',
  card: 'sk-card',
  fold: { root: 'f-root', btn: 'f-btn', chev: 'f-chev', body: 'f-body' },
};

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

  it('со skin: класс чипа, is-on по состоянию, --h из hue, без инлайн-вида', () => {
    const { rerender } = render(
      <ConceptSkinContext.Provider value={SKIN}>
        <ConceptToggleChip
          label="Неуспешность"
          color="x"
          hue={DOMAIN_HUE.rejection}
          active={false}
        />
      </ConceptSkinContext.Provider>,
    );
    const btn = screen.getByRole('button', { name: /Неуспешность/ });
    expect(btn.className).toBe('sk-chip');
    expect(btn.style.getPropertyValue('--h')).toBe(
      String(DOMAIN_HUE.rejection),
    );
    expect(btn.style.background).toBe('');
    rerender(
      <ConceptSkinContext.Provider value={SKIN}>
        <ConceptToggleChip
          label="Неуспешность"
          color="x"
          hue={DOMAIN_HUE.rejection}
          active
        />
      </ConceptSkinContext.Provider>,
    );
    expect(btn.className).toBe('sk-chip is-on');
  });

  it('со skin без hue --h не задаётся; readOnly — тег, не кнопка', () => {
    render(
      <ConceptSkinContext.Provider value={SKIN}>
        <ConceptToggleChip label="Критика" color="x" active readOnly />
      </ConceptSkinContext.Provider>,
    );
    const tag = screen.getByText('Критика');
    expect(screen.queryByRole('button')).toBeNull();
    expect(tag.className).toBe('sk-tag');
    expect(tag.style.getPropertyValue('--h')).toBe('');
  });
});
