// @vitest-environment jsdom
// Лист «Карта режимов» (#906, срез F4): шапка — ds-sheet-head, «← Назад» — ds-back, заголовок — h2.ds-h2.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MyModeMapSheet } from './ModeMapBanner';

vi.mock('../../hooks/useHistorySheet', () => ({
  useHistorySheet: (onClose: () => void) => onClose,
}));

afterEach(cleanup);

describe('MyModeMapSheet', () => {
  it('шапка: «Назад» закрывает лист, заголовок — ds-h2', () => {
    const onClose = vi.fn();
    render(<MyModeMapSheet onClose={onClose} />);
    const back = screen.getByRole('button', { name: /Назад/ });
    expect(back.classList.contains('ds-back')).toBe(true);
    expect(back.parentElement?.classList.contains('ds-sheet-head')).toBe(true);
    const h = screen.getByRole('heading', { level: 2, name: 'Карта режимов' });
    expect(h.classList.contains('ds-h2')).toBe(true);
    back.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
