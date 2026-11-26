// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useIsMobile } from '../useIsMobile';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionWorkPicker, SessionWorkPickerSheet } from './SessionWorkPickerSheet';

vi.mock('../useIsMobile', () => ({ useIsMobile: vi.fn(() => true) }));

describe('лист выбора «Что делали» (телефон)', () => {
  it('группы свёрнуты, поиск раскрывает совпадения, тап по строке отдаёт вид', () => {
    const onPick = vi.fn();
    render(<MemoryRouter><SessionWorkPickerSheet onPick={onPick} onClose={vi.fn()} /></MemoryRouter>);
    const techniques = screen.getByRole('group', { name: 'Техники' });
    expect(within(techniques).queryByText('Рескриптинг в воображении')).toBeNull();
    fireEvent.change(screen.getByLabelText('Поиск'), { target: { value: 'рескрипт' } });
    fireEvent.click(screen.getByRole('button', { name: 'Рескриптинг в воображении' }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ kind: 'technique', refId: 'imagery_rescripting' }));
  });
  it('«Ничего не нашлось» при пустой выдаче', () => {
    render(<MemoryRouter><SessionWorkPickerSheet onPick={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Поиск'), { target: { value: 'яяяя' } });
    expect(screen.getByText('Ничего не нашлось')).toBeTruthy();
  });
  it('тап по заголовку группы раскрывает её; «Своё» без заголовка', () => {
    render(<MemoryRouter><SessionWorkPickerSheet onPick={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^Техники/ }));
    expect(screen.getByRole('button', { name: 'Рескриптинг в воображении' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Своё' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Своё\d/ })).toBeNull();
  });
  it('телефон — лист с поиском, компьютер — лента без поиска', () => {
    const { unmount } = render(<MemoryRouter><SessionWorkPicker onPick={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByLabelText('Поиск')).toBeTruthy();
    unmount();
    vi.mocked(useIsMobile).mockReturnValue(false);
    render(<MemoryRouter><SessionWorkPicker onPick={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByLabelText('Поиск')).toBeNull();
    expect(screen.getByRole('button', { name: 'Работа со стульями' })).toBeTruthy();
  });
});
