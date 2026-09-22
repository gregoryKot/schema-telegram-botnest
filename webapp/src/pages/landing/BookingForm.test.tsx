// @vitest-environment jsdom
// BookingForm (лендинг терапевта) — было 45% покрытия. Проверяем: валидацию
// обязательных полей, успешную отправку («Заявка отправлена»), видимый отказ
// (правило CLAUDE.md «отказ сохранения обязан быть виден» — тут уже сделано
// правильно, тест это фиксирует) и что кнопка недоступна без согласия/полей.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { BookingForm } from './BookingForm';

vi.mock('../../api', () => ({
  api: {
    submitBooking: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function fillValid() {
  fireEvent.change(screen.getByLabelText('Имя *'), {
    target: { value: 'Ира' },
  });
  fireEvent.change(screen.getByLabelText('Telegram / телефон *'), {
    target: { value: '@ira' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Метрика (lib/metrika) грузится реально, не мокается — тест цели ниже
  // читает очередь window.ym.a напрямую (единый приём с LandingPage/BookingPicker).
  sessionStorage.clear();
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach((s) => s.remove());
});
afterEach(() => cleanup());

describe('BookingForm — валидация', () => {
  it('кнопка отправки недоступна, пока не заполнены имя, контакт и согласие', () => {
    render(<BookingForm />);
    const button = screen.getByRole('button', {
      name: /Записаться на знакомство/,
    });
    expect(button).toHaveProperty('disabled', true);

    fillValid();
    expect(
      screen.getByRole('button', { name: /Записаться на знакомство/ }),
    ).toHaveProperty('disabled', false);
  });

  it('без отметки согласия submit не вызывает api (даже если поля заполнены)', () => {
    render(<BookingForm />);
    fireEvent.change(screen.getByLabelText('Имя *'), {
      target: { value: 'Ира' },
    });
    fireEvent.change(screen.getByLabelText('Telegram / телефон *'), {
      target: { value: '@ira' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Записаться на знакомство/ }),
    );
    expect(mockApi.submitBooking).not.toHaveBeenCalled();
  });
});

describe('BookingForm — успешная отправка', () => {
  it('вызывает api.submitBooking с trim-полями и показывает «Заявка отправлена»', async () => {
    mockApi.submitBooking.mockResolvedValue({ ok: true });
    render(<BookingForm />);
    fireEvent.change(screen.getByLabelText('Имя *'), {
      target: { value: '  Ира  ' },
    });
    fireEvent.change(screen.getByLabelText('Telegram / телефон *'), {
      target: { value: '  @ira  ' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: /Записаться на знакомство/ }),
    );

    await screen.findByText('Заявка отправлена');
    expect(mockApi.submitBooking).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ира', contact: '@ira' }),
    );
  });

  it('необязательное поле «Запрос» тоже уходит trim-нутым, если заполнено', async () => {
    mockApi.submitBooking.mockResolvedValue({ ok: true });
    render(<BookingForm />);
    fillValid();
    fireEvent.change(
      screen.getByPlaceholderText('Пара слов о том, с чем хотите разобраться'),
      {
        target: { value: '  тревога  ' },
      },
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Записаться на знакомство/ }),
    );

    await waitFor(() =>
      expect(mockApi.submitBooking).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'тревога' }),
      ),
    );
  });
});

// «Отказ сохранения обязан быть виден» — здесь уже реализовано правильно
// (status='error' рендерит сообщение с прямой ссылкой на Telegram автора);
// тест фиксирует эту защиту, чтобы будущий рефакторинг её не сломал молча.
describe('BookingForm — отказ сети виден пользователю', () => {
  it('ошибка submitBooking показывает сообщение с прямой ссылкой на Telegram, форма не считается отправленной', async () => {
    mockApi.submitBooking.mockRejectedValue(new Error('network down'));
    render(<BookingForm />);
    fillValid();
    fireEvent.click(
      screen.getByRole('button', { name: /Записаться на знакомство/ }),
    );

    await screen.findByText(/Что-то не отправилось/);
    expect(screen.getByRole('link', { name: '@kotlarewski' })).toBeTruthy();
    expect(screen.queryByText('Заявка отправлена')).toBeNull();
  });

  it('после отказа кнопка снова доступна — можно повторить попытку', async () => {
    mockApi.submitBooking.mockRejectedValue(new Error('network down'));
    render(<BookingForm />);
    fillValid();
    fireEvent.click(
      screen.getByRole('button', { name: /Записаться на знакомство/ }),
    );
    await screen.findByText(/Что-то не отправилось/);

    expect(
      screen.getByRole('button', { name: /Записаться на знакомство/ }),
    ).toHaveProperty('disabled', false);
  });
});

// Продуктовая цель лендинга: эта форма — резервная запись только на
// бесплатное знакомство 15 минут (см. lib/metrika trackBookingSubmit).
describe('BookingForm — цель Метрики', () => {
  it('успешная отправка шлёт booking_submit и booking_intro', async () => {
    mockApi.submitBooking.mockResolvedValue({ ok: true });
    render(<BookingForm />);
    fillValid();
    fireEvent.click(
      screen.getByRole('button', { name: /Записаться на знакомство/ }),
    );

    await screen.findByText('Заявка отправлена');
    const goals = ((window as unknown as { ym?: { a?: unknown[][] } }).ym?.a ?? [])
      .filter((c) => c[1] === 'reachGoal')
      .map((c) => c[2]);
    expect(goals).toEqual(['booking_submit', 'booking_intro']);
  });
});

describe('BookingForm — во время отправки', () => {
  it('кнопка показывает «Отправляю…» и недоступна', async () => {
    let resolveFn: (v: { ok: true }) => void = () => {};
    mockApi.submitBooking.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );
    render(<BookingForm />);
    fillValid();
    fireEvent.click(
      screen.getByRole('button', { name: /Записаться на знакомство/ }),
    );

    expect(screen.getByRole('button', { name: 'Отправляю…' })).toHaveProperty(
      'disabled',
      true,
    );
    resolveFn({ ok: true });
    await screen.findByText('Заявка отправлена');
  });
});
