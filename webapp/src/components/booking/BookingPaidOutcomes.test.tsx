// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookingPaidAccepted, BookingPaidLoadFailed } from './BookingPaidOutcomes';
import { BookingPaidPending } from './BookingPaidPending';
import { CANCEL_SUPPORT_LINK } from './cancelPolicy';

const booking = { type: 'SESSION_50', durationMin: 50, startsAt: '2026-11-28T09:00:00.000Z', status: 'HELD' } as never;

describe('итоги записи на общем экране итога (pa-outcome)', () => {
  it('«Оплата принята» — заголовок и действие-строка на линии, без круга-значка', () => {
    const { container } = render(<BookingPaidAccepted />);
    expect(container.querySelector('.pa-outcome-body .pa-outcome-title')?.textContent).toBe('Оплата принята');
    expect(screen.getByRole('link', { name: 'На главную' }).className).toContain('pa-outcome-action');
    expect(container.querySelector('[style*="border-radius: 50%"]')).toBeNull();
  });

  it('не нашли запись — повтора нет, написать можно; сбой загрузки — «Обновить» зовёт повтор', () => {
    const { rerender } = render(<BookingPaidLoadFailed kind="notFound" onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Обновить' })).toBeNull();
    expect(screen.getByRole('link').getAttribute('href')).toBe(CANCEL_SUPPORT_LINK);
    const onRetry = vi.fn();
    rerender(<BookingPaidLoadFailed kind="failed" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ожидание: пока идёт — без кнопки; по таймауту — «Проверить ещё раз»', () => {
    const onRetry = vi.fn();
    const { rerender, container } = render(<BookingPaidPending booking={booking} timedOut={false} refreshFailed={false} onRetry={onRetry} />);
    expect(screen.queryByRole('button', { name: 'Проверить ещё раз' })).toBeNull();
    expect(container.querySelector('.pa-outcome-when')).not.toBeNull();
    rerender(<BookingPaidPending booking={booking} timedOut refreshFailed={false} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить ещё раз' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
