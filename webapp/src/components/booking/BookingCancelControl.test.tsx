// @vitest-environment jsdom
// Регрессия docs/INCIDENTS.md (2026-09-29): BookingPicker.tsx звал
// api.cancelBooking() в `catch { /* ignore */ }` — сервер отвечал
// CANCEL_TOO_LATE (booking.service.ts::cancel, до встречи < 24ч), а
// пользователь не видел ничего. Плюс вторая копия той же механики жила в
// BookingPaidPage.tsx с другим поведением (с подтверждением). Обе площадки
// теперь берут этот единственный компонент — правило «одна механика — один
// компонент», CLAUDE.md.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BookingCancelControl } from './BookingCancelControl';

const cancelBooking = vi.fn();
const reportClientError = vi.fn();
vi.mock('../../api', () => ({
  api: { cancelBooking: (...a: unknown[]) => cancelBooking(...a) },
  reportClientError: (...a: unknown[]) => reportClientError(...a),
}));

const trackGoal = vi.fn();
vi.mock('../../lib/metrika', () => ({ trackGoal: (...a: unknown[]) => trackGoal(...a) }));

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

const FAR_FUTURE = new Date(Date.now() + 30 * 24 * 3_600_000).toISOString();
const IN_3_HOURS = new Date(Date.now() + 3 * 3_600_000).toISOString();

describe('BookingCancelControl — окно < 24ч', () => {
  it('до встречи меньше 24 часов — кнопки нет, сразу текст про Telegram', () => {
    render(<BookingCancelControl cancelToken="tok" startsAt={IN_3_HOURS} onCancelled={vi.fn()} />);
    expect(screen.queryByText('Отменить запись')).toBeNull();
    expect(screen.getByText(/не позднее чем за 24 часа/)).toBeTruthy();
    const link = screen.getByText('@kotlarewski') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
  });
});

describe('BookingCancelControl — подтверждение и успех', () => {
  it('требует подтверждения перед отменой', () => {
    render(<BookingCancelControl cancelToken="tok" startsAt={FAR_FUTURE} onCancelled={vi.fn()} />);
    fireEvent.click(screen.getByText('Отменить запись'));
    expect(screen.getByText('Точно отменить эту встречу?')).toBeTruthy();
    expect(cancelBooking).not.toHaveBeenCalled();
  });

  it('«Оставить» закрывает подтверждение без отмены', () => {
    render(<BookingCancelControl cancelToken="tok" startsAt={FAR_FUTURE} onCancelled={vi.fn()} />);
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Оставить'));
    expect(screen.getByText('Отменить запись')).toBeTruthy();
    expect(cancelBooking).not.toHaveBeenCalled();
  });

  it('успешная отмена вызывает onCancelled и цель booking_cancel', async () => {
    cancelBooking.mockResolvedValue({ ok: true });
    const onCancelled = vi.fn();
    render(<BookingCancelControl cancelToken="tok" startsAt={FAR_FUTURE} onCancelled={onCancelled} />);
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Да, отменить'));
    await vi.waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(trackGoal).toHaveBeenCalledWith('booking_cancel');
  });
});

describe('BookingCancelControl — ошибка не глотается', () => {
  it('CANCEL_TOO_LATE (гонка: клиент ещё в окне, сервер уже нет) — свой текст, не тишина', async () => {
    cancelBooking.mockRejectedValue(new Error('CANCEL_TOO_LATE'));
    const onCancelled = vi.fn();
    render(<BookingCancelControl cancelToken="tok" startsAt={FAR_FUTURE} onCancelled={onCancelled} />);
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Да, отменить'));
    expect(await screen.findByText(/не позднее чем за 24 часа/)).toBeTruthy();
    expect(onCancelled).not.toHaveBeenCalled();
    expect(trackGoal).toHaveBeenCalledWith('booking_cancel_error', { reason: 'too_late' });
    // CANCEL_TOO_LATE — не сбой на нашей стороне, отчёт наверх не нужен.
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('прочая ошибка сервера — видимый текст со ссылкой на Telegram и отчёт наверх', async () => {
    cancelBooking.mockRejectedValue(new Error('network'));
    const onCancelled = vi.fn();
    render(<BookingCancelControl cancelToken="tok" startsAt={FAR_FUTURE} onCancelled={onCancelled} />);
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Да, отменить'));
    expect(await screen.findByText(/Не получилось отменить/)).toBeTruthy();
    const link = screen.getByText('Telegram') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
    expect(onCancelled).not.toHaveBeenCalled();
    expect(trackGoal).toHaveBeenCalledWith('booking_cancel_error', { reason: 'server' });
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'booking', message: expect.stringContaining('booking cancel failed') }),
    );
  });

  it('после ошибки кнопка «Отменить запись» снова доступна — можно повторить', async () => {
    cancelBooking.mockRejectedValue(new Error('network'));
    render(<BookingCancelControl cancelToken="tok" startsAt={FAR_FUTURE} onCancelled={vi.fn()} />);
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Да, отменить'));
    await screen.findByText(/Не получилось отменить/);
    expect(screen.getByText('Отменить запись')).toBeTruthy();
  });
});
