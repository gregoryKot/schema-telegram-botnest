// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../api', () => ({ reportClientError: vi.fn() }));
import { reportClientError } from '../api';
import { ApiError } from '../apiClient';
import { BookingErrorNote } from './BookingErrorNote';
import { classifyBookingFailure, handleBookingFailure } from './bookingFailure';

describe('classifyBookingFailure', () => {
  it('CLIENT_NOT_FOUND → not_found', () => {
    expect(classifyBookingFailure(new ApiError(400, 'CLIENT_NOT_FOUND'))).toBe('not_found');
  });
  it('409 и прочие 400 — «время недоступно», выбрать другое поможет', () => {
    expect(classifyBookingFailure(new ApiError(409, 'Slot already taken'))).toBe('taken');
    expect(classifyBookingFailure(new ApiError(400, 'TOO_SOON'))).toBe('taken');
  });
  it('5xx, сетевой отказ, неизвестное — сбой на моей стороне', () => {
    expect(classifyBookingFailure(new ApiError(500, 'boom'))).toBe('error');
    expect(classifyBookingFailure(new ApiError(502, 'bad gateway'))).toBe('error');
    expect(classifyBookingFailure(new TypeError('Failed to fetch'))).toBe('error');
    expect(classifyBookingFailure('???')).toBe('error');
  });
});

describe('handleBookingFailure', () => {
  beforeEach(() => vi.mocked(reportClientError).mockClear());
  it('сообщает наверх только про наш сбой, с секцией booking и без PII', () => {
    expect(handleBookingFailure(new TypeError('Failed to fetch'))).toBe('error');
    expect(reportClientError).toHaveBeenCalledWith({ message: 'booking submit failed: Failed to fetch', section: 'booking' });
  });
  it('занятый слот наверх не уходит — это не поломка', () => {
    expect(handleBookingFailure(new ApiError(409, 'taken'))).toBe('taken');
    expect(reportClientError).not.toHaveBeenCalled();
  });
});

describe('BookingErrorNote', () => {
  it('taken — про другое время, без ссылки на Telegram', () => {
    render(<BookingErrorNote kind="taken" />);
    expect(screen.getByText(/Выберите другое/)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('error — заявка не сохранилась, ссылка на Telegram, без «обновите страницу»', () => {
    render(<BookingErrorNote kind="error" />);
    expect(screen.getByText(/Заявка не сохранилась/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '@kotlarewski' })).toBeTruthy();
    expect(screen.queryByText(/Обновите/)).toBeNull();
  });
});
