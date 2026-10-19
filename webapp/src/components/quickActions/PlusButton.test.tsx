// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { markSheetOpen } from '../../hooks/openSheets';
import { PlusButton } from './PlusButton';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';

describe('PlusButton', () => {
  it('тап шлёт plus_open и открывает лист', () => {
    const onOpen = vi.fn();
    render(<PlusButton onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Быстрое действие' }));
    expect(api.trackEvent).toHaveBeenCalledWith('plus_open');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('пока открыт любой лист — кнопки нет, лист закрыт — вернулась', () => {
    render(<PlusButton onOpen={vi.fn()} />);
    let unmark = () => {};
    act(() => { unmark = markSheetOpen('any-sheet'); });
    expect(screen.queryByRole('button', { name: 'Быстрое действие' })).toBeNull();
    act(() => unmark());
    expect(screen.getByRole('button', { name: 'Быстрое действие' })).toBeTruthy();
  });

  it('пока человек печатает на телефоне — кнопки нет', () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('pointer: coarse'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    render(<div><PlusButton onOpen={vi.fn()} /><textarea aria-label="поле" /></div>);
    act(() => { screen.getByLabelText('поле').focus(); });
    expect(screen.queryByRole('button', { name: 'Быстрое действие' })).toBeNull();
    act(() => { screen.getByLabelText('поле').blur(); });
    expect(screen.getByRole('button', { name: 'Быстрое действие' })).toBeTruthy();
  });
});
