// @vitest-environment jsdom
// BookingPaidPage — экран возврата с Robokassa (0% покрытия). Проверяем все
// ветки body: fail=1, без токена, с токеном (успех/без ссылки/404 по токену;
// остальные отказы загрузки — в BookingPaidPage.loadFail.test.tsx), отмену записи (успех и «поздно отменять» отдельным текстом —
// правило «провал не выглядит как успех»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BookingPaidPage } from './BookingPaidPage';
import { MEETING_LINK_LATER } from '../components/booking/BookingSaveBlock';
import { ApiError } from '../apiClient';

const getBookingByToken = vi.fn();
const cancelBooking = vi.fn();
vi.mock('../api', () => ({
  api: {
    getBookingByToken: (...a: unknown[]) => getBookingByToken(...a),
    cancelBooking: (...a: unknown[]) => cancelBooking(...a),
  },
  reportClientError: vi.fn(),
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

// startsAt — далеко в будущем (не привязано к "сегодня" прогона теста), чтобы
// BookingCancelControl всегда показывал кнопку отмены в этих тестах; для
// проверки окна < 24 часов — отдельный тест с относительным временем.
const BOOKING = {
  status: 'CONFIRMED', paid: true, type: 'SESSION_50' as const,
  startsAt: '2099-08-10T10:00:00Z', endsAt: '2099-08-10T10:50:00Z',
  durationMin: 50,
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
  it('пока бронь грузится — силуэт экрана (скелетон), не пустота и не «подтверждена»', () => {
    setUrl('?token=abc');
    getBookingByToken.mockReturnValue(new Promise(() => {}));
    const { container } = render(<BookingPaidPage />);
    expect(container.querySelectorAll('.skel').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/Встреча подтверждена/)).toBeNull();
    expect(screen.queryByText('Загружаем…')).toBeNull();
  });

  // Аудит 2026-10: страница открывается по токену, а его получает любой, кто
  // записался с чужим контактом, — ссылку на встречу присылает владелец, а
  // экран не зовёт вечно жать «Обновить» в ожидании ссылки.
  it('успешная загрузка: «Оплата прошла» и обещание прислать ссылку, без кнопок встречи и «Обновить»', async () => {
    setUrl('?token=abc');
    getBookingByToken.mockResolvedValue(BOOKING);
    render(<BookingPaidPage />);
    expect(await screen.findByText('Оплата прошла')).toBeTruthy();
    expect(screen.getByText(MEETING_LINK_LATER)).toBeTruthy();
    expect(screen.queryByText('Подключиться к встрече')).toBeNull();
    expect(screen.queryByText('Обновить')).toBeNull();
  });

  it('токен, которого сервер не знает (404), — «запись не найдена», а не «Оплата принята»', async () => {
    setUrl('?token=bad');
    getBookingByToken.mockRejectedValue(new ApiError(404, 'Not Found'));
    render(<BookingPaidPage />);
    expect(await screen.findByText('Запись по этой ссылке не найдена')).toBeTruthy();
    expect(screen.queryByText('Оплата принята')).toBeNull();
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

  it('прочая ошибка отмены показывает видимый текст со ссылкой на Telegram, встреча остаётся активной', async () => {
    // Регрессия «провал не выглядит как успех»: без этого текста юзер решил
    // бы, что запись отменилась.
    cancelBooking.mockRejectedValue(new Error('network'));
    render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    fireEvent.click(screen.getByText('Отменить запись'));
    fireEvent.click(screen.getByText('Да, отменить'));
    expect(await screen.findByText(/Не получилось отменить/)).toBeTruthy();
    const link = screen.getByText('Telegram') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
    expect(screen.queryByText('Запись отменена')).toBeNull();
  });

  // Инцидент 2026-09-29 (docs/INCIDENTS.md): BookingPicker.tsx глотал ошибку
  // отмены (`catch { /* ignore */ }`) — сервер отвечал CANCEL_TOO_LATE, а
  // пользователь видел тишину. Общий BookingCancelControl прячет кнопку
  // заранее, если до встречи меньше 24 часов, и всегда показывает текст при
  // отказе сервера — здесь та же гарантия, что и в общем компоненте.
  it('до встречи меньше 24 часов — кнопки нет, сразу текст про Telegram', async () => {
    const soon = { ...BOOKING, startsAt: new Date(Date.now() + 3 * 3_600_000).toISOString() };
    getBookingByToken.mockResolvedValue(soon);
    render(<BookingPaidPage />);
    await screen.findByText('Оплата прошла');
    expect(screen.queryByText('Отменить запись')).toBeNull();
    expect(screen.getByText(/не позднее чем за 24 часа/)).toBeTruthy();
  });
});

// Аудит 2026-10: бесплатная вводная на /booking/manage говорила «Оплата
// прошла… Чек придёт», хотя оплаты у неё нет, а подтверждение — личное.
describe('BookingPaidPage — подтверждённая бронь без оплаты', () => {
  beforeEach(() => window.history.pushState({}, '', '/booking/manage?token=tok'));

  it('INTRO_15: знакомство бесплатное, ни «Оплата прошла», ни чека', async () => {
    getBookingByToken.mockResolvedValue({ ...BOOKING, type: 'INTRO_15', paid: false, durationMin: 15 });
    render(<BookingPaidPage />);
    expect(await screen.findByText('Знакомство записано')).toBeTruthy();
    expect(screen.getByText(/без подтверждения она не состоится/)).toBeTruthy();
    expect(screen.queryByText('Оплата прошла')).toBeNull();
    expect(screen.queryByText(/Чек|Мой налог/)).toBeNull();
  });

  it('SESSION_50 без онлайн-оплаты: «Встреча подтверждена», без чека', async () => {
    getBookingByToken.mockResolvedValue({ ...BOOKING, paid: false });
    render(<BookingPaidPage />);
    expect(await screen.findByText('Встреча подтверждена')).toBeTruthy();
    expect(screen.queryByText('Оплата прошла')).toBeNull();
    expect(screen.queryByText(/Чек|Мой налог/)).toBeNull();
  });

  it('контрольный: оплаченная сессия — «Оплата прошла» и чек', async () => {
    getBookingByToken.mockResolvedValue(BOOKING);
    render(<BookingPaidPage />);
    expect(await screen.findByText('Оплата прошла')).toBeTruthy();
    expect(screen.getByText(/Чек придёт от «Мой налог»/)).toBeTruthy();
  });
});
