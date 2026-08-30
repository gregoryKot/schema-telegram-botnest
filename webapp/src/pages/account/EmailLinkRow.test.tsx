// @vitest-environment jsdom
// Регрессия на вынос блока email из AccountPage (страница упиралась в лимит
// размера). Поведение обязано остаться прежним: форма видна только когда
// адрес не привязан, отправка ведёт на экран «письмо отправлено», а отказ
// сервера виден человеку текстом, а не тишиной.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EmailLinkRow } from './EmailLinkRow';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

/** Ошибку показывает страница — здесь её крошечный дублёр, чтобы проверять
 *  «видно текстом», а не только вызов колбэка. */
function Harness({
  linked = false,
  email = null,
  form = 'ty',
}: {
  linked?: boolean;
  email?: string | null;
  form?: AddressForm;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      {error && <div>{error}</div>}
      <EmailLinkRow
        accessToken="tok123"
        linked={linked}
        email={email}
        busy={false}
        onUnlink={vi.fn()}
        onError={setError}
      />
    </AddressFormContext.Provider>
  );
}

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, {})));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EmailLinkRow — когда видна форма', () => {
  it('адрес не привязан — «Привязать» открывает поле ввода', () => {
    render(<Harness />);
    expect(screen.getByText('не привязан')).toBeTruthy();
    expect(screen.queryByPlaceholderText('your@email.com')).toBeNull();

    fireEvent.click(screen.getByText('Привязать'));

    expect(screen.getByPlaceholderText('your@email.com')).toBeTruthy();
  });

  it('адрес привязан — вместо формы отвязка и сам адрес', () => {
    render(<Harness linked email="me@example.com" />);

    expect(screen.getByText('me@example.com')).toBeTruthy();
    expect(screen.getByText('Отвязать')).toBeTruthy();
    expect(screen.queryByText('Привязать')).toBeNull();
  });
});

describe('EmailLinkRow — отправка письма', () => {
  it('успех — POST с введённым адресом и экран «письмо отправлено»', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Привязать'));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByText('Отправить'));

    await screen.findByText(/Письмо отправлено на/);
    expect(screen.getByText('me@example.com')).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/email/link-to-account');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'me@example.com',
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok123',
    );
  });

  it('«Ввести другой email» возвращает форму', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Привязать'));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByText('Отправить'));
    await screen.findByText(/Письмо отправлено на/);

    fireEvent.click(screen.getByText('Ввести другой email'));

    expect(screen.getByPlaceholderText('your@email.com')).toBeTruthy();
    expect(screen.queryByText(/Письмо отправлено на/)).toBeNull();
  });

  it('отказ сервера виден текстом и не выдаётся за отправку', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { message: 'Email уже занят' }),
    );
    render(<Harness />);
    fireEvent.click(screen.getByText('Привязать'));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.click(screen.getByText('Отправить'));

    await screen.findByText('Email уже занят');
    expect(screen.queryByText(/Письмо отправлено на/)).toBeNull();
  });

  it('форма «вы» — подсказка после отправки во «вы»', async () => {
    render(<Harness form="vy" />);
    fireEvent.click(screen.getByText('Привязать'));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByText('Отправить'));

    await screen.findByText(/Перейдите по ссылке в письме/);
    expect(screen.queryByText(/Перейди по ссылке в письме/)).toBeNull();
  });
});
