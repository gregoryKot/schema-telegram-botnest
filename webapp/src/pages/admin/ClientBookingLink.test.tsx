// @vitest-environment jsdom
// Ссылка для клиентов в админке: адрес виден, «Скопировать» кладёт его в
// буфер; отказ clipboard не выглядит как успех (правило «провал ≠ успех»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('../../api', () => ({ reportClientError: vi.fn() }));
import { reportClientError } from '../../api';
import { ClientBookingLink, CLIENT_BOOKING_URL } from './ClientBookingLink';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const mockClipboard = (writeText: (t: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

describe('ClientBookingLink', () => {
  it('показывает адрес /book ссылкой и копирует его по кнопке', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<ClientBookingLink />);
    expect(CLIENT_BOOKING_URL).toBe('https://kotlarewski.gr/book');
    expect(screen.getByRole('link', { name: CLIENT_BOOKING_URL }).getAttribute('href')).toBe(CLIENT_BOOKING_URL);

    fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }));
    await screen.findByText('Скопировано ✓');
    expect(writeText).toHaveBeenCalledWith(CLIENT_BOOKING_URL);
  });

  it('отказ буфера обмена — честное «не скопировалось», не галочка', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    render(<ClientBookingLink />);
    fireEvent.click(screen.getByRole('button', { name: 'Скопировать' }));
    await screen.findByText(/Не скопировалось/);
    expect(screen.queryByText('Скопировано ✓')).toBeNull();
    expect(reportClientError).toHaveBeenCalledWith({ message: 'admin link copy failed', section: 'admin' });
  });

  it('подпись исхода гаснет сама, а не висит до перезагрузки (сброс общего хука)', async () => {
    vi.useFakeTimers();
    try {
      mockClipboard(vi.fn().mockResolvedValue(undefined));
      render(<ClientBookingLink />);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Скопировать' })); });
      expect(screen.getByText('Скопировано ✓')).toBeTruthy();
      // Подпись держится 6 с (подсказку об отказе надо успеть прочитать), потом гаснет.
      act(() => { vi.advanceTimersByTime(5000); });
      expect(screen.getByText('Скопировано ✓')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.queryByText('Скопировано ✓')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
