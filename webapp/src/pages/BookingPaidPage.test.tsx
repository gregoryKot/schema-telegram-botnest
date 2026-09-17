// @vitest-environment jsdom
// BookingPaidPage — экран возврата с Robokassa (0% покрытия). Проверяем все
// пять веток body: fail=1, без токена, с токеном (успех/без ссылки/ошибка
// загрузки), отмену записи (успех и «поздно отменять» отдельным текстом —
// правило «провал не выглядит как успех»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BookingPaidPage } from './BookingPaidPage';

const getBookingByToken = vi.fn();
const cancelBooking = vi.fn();
vi.mock('../api', () => ({
  api: {
    getBookingByToken: (...a: unknown[]) => getBookingByToken(...a),
    cancelBooking: (...a: unknown[]) => cancelBooking(...a),
  },
}));

function setUrl(search: string) {
  window.history.pushState({}, '', `/booking/paid${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  setUrl('');
});

const BOOKING = {
  status: 'CONFIRMED', type: 'SESSION_50' as const,
  startsAt: '2026-08-10T10:00:00Z', endsAt: '2026-08-10T10:50:00Z',
  durationMin: 50, meetingUrl: 'https://meet.example/xyz',
};

describe('BookingPaidPage — без токена', () => {
  it('оплата принята без данных встречи (напр. успели удалить токен)', () => {
    setUrl('');
    render(<BookingPaidPage />);
    expect(screen.getByText('Оплата принята')).toBeTruthy();
  });
});

describe('BookingPaidPage — fail=1', () => {
  it('показывает, что деньги не списаны, и путь вернуться к записи', () => {
    setUrl('?fail=1');
    render(<BookingPaidPage />);
    expect(screen.getByText('Оплата не прошла')).toBeTruthy();
    expect(screen.getByText('Вернуться к записи')).toBeTruthy();
  });
});

describe('BookingPaidPage — с токеном', () => {
  it('пока бронь грузится — показывает «Загружаем…», не пустой экран', () => {
    setUrl('?token=abc');
    getBookingByToken.mockReturnValue(new Promise(() => {}));
    render(<BookingPaidPage />);
    expect(screen.getByText('Загружаем…')).toBeTruthy();
  });

  it('успешная загрузка показывает время встречи и ссылку на видеовстречу', async () => {
    setUrl('?token=abc');
    getBookingByToken.mockResolvedValue(BOOKING);
    render(<BookingPaidPage />);
    expect(await screen.findByText('Оплата прошла')).toBeTruthy();
    const link = screen.getByText('Подключиться к встрече') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(BOOKING.meetingUrl);
  });

  it('без готовой ссылки на встречу предлагает обновить, не выдаёт битую ссылку', async () => {
    setUrl('?token=abc');
    getBookingByToken.mockResolvedValue({ ...BOOKING, meetingUrl: null });
    render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    expect(screen.getByText(/Ссылку на видеовстречу готовим/)).toBeTruthy();
    expect(screen.queryByText('Подключиться к встрече')).toBeNull();
  });

  it('провал загрузки брони по токену показывает «Оплата принята» без деталей, не мусор', async () => {
    setUrl('?token=bad');
    getBookingByToken.mockRejectedValue(new Error('404'));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Оплата принята')).toBeTruthy();
  });

  it('токен убирается из адресной строки после загрузки (не утекает в Referer)', async () => {
    setUrl('?token=abc');
    getBookingByToken.mockResolvedValue(BOOKING);
    render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    expect(window.location.search).toBe('');
  });
});

describe('BookingPaidPage — отмена записи', () => {
  beforeEach(() => {
    setUrl('?token=abc');
    getBookingByToken.mockResolvedValue(BOOKING);
  });

  it('требует подтверждения перед отменой — сразу не отменяет', async () => {
    render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    fireEvent.click(screen.getByText('Отменить запись'));
    expect(screen.getByText('Точно отменить эту встречу?')).toBeTruthy();
    expect(cancelBooking).not.toHaveBeenCalled();
  });

  it('«Оставить» закрывает подтверждение без отмены', async () => {
    render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Оставить'));
    expect(screen.queryByText('Точно отменить эту встречу?')).toBeNull();
    expect(cancelBooking).not.toHaveBeenCalled();
  });

  it('подтверждённая отмена показывает экран «Запись отменена»', async () => {
    cancelBooking.mockResolvedValue({ ok: true });
    render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Да, отменить'));
    expect(await screen.findByText('Запись отменена')).toBeTruthy();
  });

  it('отмена позже 24 часов — отдельный текст, не общая ошибка', async () => {
    cancelBooking.mockRejectedValue(new Error('CANCEL_TOO_LATE'));
    render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Да, отменить'));
    expect(await screen.findByText(/не позднее чем за 24 часа/)).toBeTruthy();
    expect(screen.getByText('Оплата прошла')).toBeTruthy();
  });

  it('прочая ошибка отмены показывает видимый текст, встреча остаётся активной', async () => {
    // Регрессия «провал не выглядит как успех»: без этого текста юзер решил
    // бы, что запись отменилась.
    cancelBooking.mockRejectedValue(new Error('network'));
    render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Да, отменить'));
    expect(await screen.findByText('Не получилось отменить. Попробуйте ещё раз или напишите мне.')).toBeTruthy();
    expect(screen.queryByText('Запись отменена')).toBeNull();
  });
});
