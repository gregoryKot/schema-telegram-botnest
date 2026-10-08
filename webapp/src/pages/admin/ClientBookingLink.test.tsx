// @vitest-environment jsdom
// Ссылка для клиентов в админке: адрес виден, «Скопировать» кладёт его в
// буфер; отказ clipboard не выглядит как успех (правило «провал ≠ успех»).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ClientBookingLink, CLIENT_BOOKING_URL } from './ClientBookingLink';

afterEach(() => cleanup());

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
  });
});
