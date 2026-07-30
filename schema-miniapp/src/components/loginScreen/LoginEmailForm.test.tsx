// @vitest-environment jsdom
// Email-флоу: невалидный email не уходит, валидный шлёт POST с заголовком
// x-requested-with (CSRF), успех показывает «письмо отправлено», ошибка
// сервера показывается текстом (правило CLAUDE.md «ошибки не глотаем»).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { LoginEmailForm } from './LoginEmailForm';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cleanup();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function openForm() {
  render(<LoginEmailForm />);
  fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
}

describe('LoginEmailForm — валидация', () => {
  it('невалидный email не отправляется и не зовёт fetch', () => {
    openForm();
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'не-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить ссылку' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Введи корректный email')).toBeTruthy();
  });
});

describe('LoginEmailForm — валидный email', () => {
  it('шлёт POST /api/auth/email/link с заголовком x-requested-with и переходит в «письмо отправлено»', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    openForm();
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить ссылку' }));
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/email/link'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-requested-with': 'miniapp' }),
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    );
    expect(screen.getByText('Письмо отправлено')).toBeTruthy();
  });
});

describe('LoginEmailForm — ошибка сервера', () => {
  it('показывает сообщение сервера, а не глотает ошибку', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, { message: 'Слишком много попыток' }),
    );
    openForm();
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить ссылку' }));

    await screen.findByText('Слишком много попыток');
  });
});

describe('LoginEmailForm — ты/вы', () => {
  it('форма «вы»: ошибка невалидного email звучит на «вы»', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: () => {} }}>
        <LoginEmailForm />
      </AddressFormContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'не-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить ссылку' }));
    expect(screen.getByText('Введите корректный email')).toBeTruthy();
  });

  it('форма «вы»: сообщение «письмо отправлено» звучит на «вы»', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: () => {} }}>
        <LoginEmailForm />
      </AddressFormContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Войти по email' }));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Отправить ссылку' }));

    await screen.findByText(/Проверьте почту/);
  });
});
