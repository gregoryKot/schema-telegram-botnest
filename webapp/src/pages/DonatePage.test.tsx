// @vitest-environment jsdom
// Компонентные тесты DonatePage: сабмит суммы доната, honeypot-поле,
// минимальная сумма, ошибка API. Мок '../api'.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { DonatePage } from './DonatePage';

vi.mock('../api', () => ({
  api: { donate: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function resetLocation() {
  window.history.pushState({}, '', '/donate');
}

beforeEach(() => {
  vi.clearAllMocks();
  resetLocation();
});

afterEach(() => {
  cleanup();
  resetLocation();
});

function honeypotInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="text"]') as HTMLInputElement;
}

describe('DonatePage — выбор суммы', () => {
  it('по умолчанию выбрана сумма 500 ₽', () => {
    render(<DonatePage />);
    expect(screen.getByRole('button', { name: /Поддержать 500/ })).toBeTruthy();
  });

  it('клик по пресету суммы меняет отображаемую сумму на кнопке', () => {
    render(<DonatePage />);
    fireEvent.click(screen.getByRole('button', { name: '1000 ₽' }));
    expect(screen.getByRole('button', { name: /Поддержать 1[\s ]000/ })).toBeTruthy();
  });
});

describe('DonatePage — сабмит суммы', () => {
  it('вызывает api.donate с введённой суммой, source и email', async () => {
    mockApi.donate.mockResolvedValue({ paymentUrl: null });
    render(<DonatePage />);
    fireEvent.change(screen.getByPlaceholderText('Email для чека (необязательно)'), {
      target: { value: 'donor@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Поддержать/ }));

    await act(async () => {});

    expect(mockApi.donate).toHaveBeenCalledWith({
      amount: 500,
      source: 'app',
      email: 'donor@example.com',
      website: '',
    });
  });

  it('своя сумма из поля ввода передаётся в api.donate', async () => {
    mockApi.donate.mockResolvedValue({ paymentUrl: null });
    render(<DonatePage />);
    fireEvent.change(screen.getByPlaceholderText('Своя сумма, ₽'), {
      target: { value: '750' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Поддержать 750/ }));

    await act(async () => {});

    expect(mockApi.donate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 750 }),
    );
  });
});

describe('DonatePage — минимальная сумма', () => {
  it('сумма меньше 10 ₽ блокирует кнопку сабмита', () => {
    render(<DonatePage />);
    fireEvent.change(screen.getByPlaceholderText('Своя сумма, ₽'), {
      target: { value: '5' },
    });
    const btn = screen.getByRole('button', { name: /Поддержать 5/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('DonatePage — honeypot-поле', () => {
  it('значение скрытого honeypot-поля передаётся в api.donate как есть', async () => {
    mockApi.donate.mockResolvedValue({ paymentUrl: null });
    const { container } = render(<DonatePage />);
    fireEvent.change(honeypotInput(container), { target: { value: 'bot-filled' } });
    fireEvent.click(screen.getByRole('button', { name: /Поддержать/ }));

    await act(async () => {});

    expect(mockApi.donate).toHaveBeenCalledWith(
      expect.objectContaining({ website: 'bot-filled' }),
    );
  });
});

describe('DonatePage — ошибка API', () => {
  it('ошибка api.donate показывает сообщение об ошибке пользователю', async () => {
    mockApi.donate.mockRejectedValue(new Error('payment gateway down'));
    render(<DonatePage />);
    fireEvent.click(screen.getByRole('button', { name: /Поддержать/ }));

    await screen.findByText('Не получилось. Попробовать ещё раз.');
  });
});

// security#27: Вебвизор визитки не должен писать ввод email (политика
// конфиденциальности обещает обратное) — метка ym-disable-keys, как у формы записи.
describe('DonatePage — Вебвизор не пишет ввод', () => {
  it('поле email несёт ym-disable-keys', () => {
    render(<DonatePage />);
    const email = screen.getByPlaceholderText('Email для чека (необязательно)') as HTMLInputElement;
    expect(email.type).toBe('email');
    expect(email.className).toContain('ym-disable-keys');
  });

  it('поле суммы несёт ym-disable-keys: политика обещает «поля ввода не записываются» без исключений', () => {
    render(<DonatePage />);
    const amount = screen.getByPlaceholderText('Своя сумма, ₽') as HTMLInputElement;
    expect(amount.type).toBe('number');
    expect(amount.className).toContain('ym-disable-keys');
  });
});
