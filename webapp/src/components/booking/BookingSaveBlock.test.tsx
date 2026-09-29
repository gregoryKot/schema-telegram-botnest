// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BookingSaveBlock } from './BookingSaveBlock';

const reportClientError = vi.fn();
vi.mock('../../api', () => ({ reportClientError: (...a: unknown[]) => reportClientError(...a) }));

const trackGoal = vi.fn();
vi.mock('../../lib/metrika', () => ({ trackGoal: (...a: unknown[]) => trackGoal(...a) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => vi.clearAllMocks());

const PROPS = {
  cancelToken: 'tok-1',
  startsAt: '2026-09-30T16:00:00.000Z',
  durationMin: 50,
  type: 'SESSION_50' as const,
  meetingUrl: 'https://meet.example/room',
  tz: 'Europe/Moscow',
};

describe('BookingSaveBlock — добавить в календарь', () => {
  it('ссылка Google Календаря ведёт на calendar.google.com и шлёт цель при клике', () => {
    render(<BookingSaveBlock {...PROPS} />);
    const link = screen.getByText('Google Календарь') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('calendar.google.com/calendar/render');
    fireEvent.click(link);
    expect(trackGoal).toHaveBeenCalledWith('booking_calendar_add', { kind: 'google' });
  });

  it('ссылка .ics ведёт на /api/booking/ics/:token и шлёт цель при клике', () => {
    render(<BookingSaveBlock {...PROPS} />);
    const link = screen.getByText('Apple / Outlook (.ics)') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/api/booking/ics/tok-1');
    fireEvent.click(link);
    expect(trackGoal).toHaveBeenCalledWith('booking_calendar_add', { kind: 'ics' });
  });
});

describe('BookingSaveBlock — сохранить ссылку', () => {
  it('ссылка «Отправить себе в Telegram» — t.me/share/url с управляющей ссылкой в url', () => {
    render(<BookingSaveBlock {...PROPS} />);
    const link = screen.getByText('Отправить себе в Telegram') as HTMLAnchorElement;
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('https://t.me/share/url?');
    expect(href).toContain(encodeURIComponent('/booking/manage?token=tok-1'));
    fireEvent.click(link);
    expect(trackGoal).toHaveBeenCalledWith('booking_link_saved', { via: 'telegram' });
  });

  it('«Скопировать ссылку» — успешное копирование меняет текст на «Скопировано ✓» и шлёт цель', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<BookingSaveBlock {...PROPS} />);
    fireEvent.click(screen.getByText('Скопировать ссылку'));
    expect(await screen.findByText('Скопировано ✓')).toBeTruthy();
    expect(trackGoal).toHaveBeenCalledWith('booking_link_saved', { via: 'copy' });
  });

  it('отказ буфера обмена показывает подсказку и уходит в reportClientError, а не тишина', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<BookingSaveBlock {...PROPS} />);
    fireEvent.click(screen.getByText('Скопировать ссылку'));
    expect(await screen.findByText(/Не удалось скопировать/)).toBeTruthy();
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'booking', message: expect.stringContaining('manage link copy failed') }),
    );
  });

  it('«Поделиться…» показывается только когда navigator.share существует', () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined });
    render(<BookingSaveBlock {...PROPS} />);
    expect(screen.queryByText('Поделиться…')).toBeNull();
  });

  it('«Поделиться…» вызывает navigator.share и шлёт цель при успехе', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    render(<BookingSaveBlock {...PROPS} />);
    fireEvent.click(screen.getByText('Поделиться…'));
    await vi.waitFor(() => expect(trackGoal).toHaveBeenCalledWith('booking_link_saved', { via: 'share' }));
    expect(share).toHaveBeenCalled();
  });

  it('отмена шторки шаринга (AbortError) не уходит в reportClientError', async () => {
    const err = new Error('cancelled'); err.name = 'AbortError';
    const share = vi.fn().mockRejectedValue(err);
    vi.stubGlobal('navigator', { ...navigator, share });
    render(<BookingSaveBlock {...PROPS} />);
    fireEvent.click(screen.getByText('Поделиться…'));
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('прочая ошибка шаринга уходит в reportClientError', async () => {
    const share = vi.fn().mockRejectedValue(new Error('boom'));
    vi.stubGlobal('navigator', { ...navigator, share });
    render(<BookingSaveBlock {...PROPS} />);
    fireEvent.click(screen.getByText('Поделиться…'));
    await vi.waitFor(() =>
      expect(reportClientError).toHaveBeenCalledWith(
        expect.objectContaining({ section: 'booking', message: expect.stringContaining('booking share failed') }),
      ),
    );
  });
});

describe('BookingSaveBlock — персональная ссылка на встречу', () => {
  it('с meetingUrl — строка со ссылкой и кнопкой «Скопировать»', () => {
    render(<BookingSaveBlock {...PROPS} />);
    expect(screen.getByText('Ссылка на встречу:')).toBeTruthy();
  });

  it('без meetingUrl — строки нет', () => {
    render(<BookingSaveBlock {...PROPS} meetingUrl={null} />);
    expect(screen.queryByText('Ссылка на встречу:')).toBeNull();
  });
});
