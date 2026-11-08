// @vitest-environment jsdom
// Регрессия на вынос блока email из AccountPage (страница упиралась в лимит
// размера). Поведение обязано остаться прежним: форма видна только когда
// адрес не привязан, отправка ведёт на экран «письмо отправлено», а отказ
// сервера виден человеку текстом, а не тишиной.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StepUpProvider } from '../../components/stepUp/StepUpProvider';
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
  // Онбординг: до первого нажатия видно, зачем привязывать почту, — она
  // запасной ключ (восстановления доступа по почте нет).
  it('адрес не привязан — подсказка «зачем» видна до нажатия', () => {
    render(<Harness />);
    expect(
      screen.getByText(
        'Пригодится, если пропадёт доступ к Telegram или другому способу входа.',
      ),
    ).toBeTruthy();
  });

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
    expect(screen.queryByText(/Пригодится, если пропадёт доступ/)).toBeNull();
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

    await screen.findByText(/письмо придёт в течение минуты/);
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

  // B-16 (аудит 2026-10): сервер отвечает одинаково для свободного и занятого
  // адреса, поэтому экран не обещает «письмо отправлено» и не говорит «занят».
  it('после отправки — нейтральный текст: не «отправлено» и не «уже привязан»', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Привязать'));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByText('Отправить'));
    await screen.findByText(/Если адрес свободен, письмо придёт в течение минуты/);
    expect(screen.queryByText(/Письмо отправлено/)).toBeNull();
    expect(screen.queryByText(/уже привязан/)).toBeNull();
  });

  it('«Ввести другой email» возвращает форму', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Привязать'));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByText('Отправить'));
    await screen.findByText(/письмо придёт в течение минуты/);

    fireEvent.click(screen.getByText('Ввести другой email'));

    expect(screen.getByPlaceholderText('your@email.com')).toBeTruthy();
    expect(screen.queryByText(/письмо придёт в течение минуты/)).toBeNull();
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
    expect(screen.queryByText(/письмо придёт в течение минуты/)).toBeNull();
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

// S12 (аудит 2026-11): у аккаунта с 2FA новый способ входа — только с кодом.
// Сервер отвечает 403 totp_required → общее окно кода → тот же запрос с
// `x-totp-code`; окно закрыли — письмо не уходит, форма остаётся.
describe('EmailLinkRow — включённая 2FA', () => {
  const need = () => new Response(JSON.stringify({ reason: 'totp_required' }), { status: 403 });
  const totp = (init?: RequestInit) => (init?.headers as Record<string, string>)['x-totp-code'];

  function renderWithStepUp() {
    render(
      <MemoryRouter>
        <StepUpProvider><Harness /></StepUpProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Привязать'));
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), { target: { value: 'me@example.com' } });
    fireEvent.click(screen.getByText('Отправить'));
  }
  async function codeDialog() {
    await screen.findByText('Подтверди, что это ты');
    await act(() => new Promise((r) => setTimeout(r, 0)));
  }

  it('403 totp_required → код → письмо уходит повтором с кодом', async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) =>
      Promise.resolve(totp(init) === '123456' ? jsonResponse(200, {}) : need()));
    renderWithStepUp();
    await codeDialog();
    fireEvent.change(screen.getByLabelText('Код из приложения'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
    await screen.findByText(/письмо придёт в течение минуты/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('окно закрыто — письма нет, форма на месте, ошибки нет', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(need()));
    renderWithStepUp();
    await codeDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    await waitFor(() => expect(screen.queryByText('Подтверди, что это ты')).toBeNull());
    expect(screen.getByPlaceholderText('your@email.com')).toBeTruthy();
    expect(screen.queryByText(/письмо придёт/)).toBeNull();
    expect(screen.queryByText(/Нужен код|Не удалось/)).toBeNull();
  });
});
