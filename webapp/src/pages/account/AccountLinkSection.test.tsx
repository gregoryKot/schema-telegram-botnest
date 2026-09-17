// @vitest-environment jsdom
// Карточка объединения аккаунтов в кабинете сайта.
//
// Главное, что тут проверяется, — кому она показывается и куда ведёт: ссылка
// с чужим кодом это путь к чужому аккаунту, а лишний показ учит нажимать на
// «объедините аккаунты» всех подряд. Плюс обе формы обращения: инфраструктура
// ты/вы существует, но свип 2026-08 нашёл экраны, где её просто не позвали.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { AccountLinkSection } from './AccountLinkSection';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { botUsername } from '../../utils/botConfig';
import { authedFetch } from '../../apiClient';
import { api } from '../../api';
import { useAuth } from '../../auth/authContext';
import type { AccountProvider } from './ProviderRows';

vi.mock('../../apiClient', () => ({ authedFetch: vi.fn() }));
vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
vi.mock('../../auth/authContext', () => ({ useAuth: vi.fn() }));

const mockedFetch = authedFetch as unknown as ReturnType<typeof vi.fn>;
const mockedApi = api as unknown as { trackEvent: ReturnType<typeof vi.fn> };
const mockedAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

const TICKET = {
  deviceCode: 'device-secret',
  userCode: 'ABCD2345',
  expiresIn: 600,
  interval: 5,
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function provider(p: AccountProvider['provider']): AccountProvider {
  return { provider: p, email: null, displayName: null };
}

function renderSection(
  providers: AccountProvider[],
  form: AddressForm = 'ty',
  onLinked = vi.fn(),
) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <AccountLinkSection providers={providers} onLinked={onLinked} />
    </AddressFormContext.Provider>,
  );
}

/** Ссылка «Подключить Telegram» появляется, когда билет уже выписан. */
function findLink() {
  return screen.findByRole('link');
}

beforeEach(() => {
  mockedFetch.mockResolvedValue(jsonResponse(200, TICKET));
  mockedAuth.mockReturnValue({ setAccessToken: vi.fn() });
  // Опрос билета ходит голым fetch (он анонимный) — до первого круга в тесте
  // дело не доходит (интервал 5 c), но глобальный fetch пусть будет свой.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse(200, { status: 'pending' }))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AccountLinkSection — кому показывается', () => {
  it('вход только через сайт — карточка ведёт в бота с выписанным кодом', async () => {
    renderSection([provider('google')]);

    const link = await findLink();
    expect(link.getAttribute('href')).toBe(
      `https://t.me/${botUsername}?start=link_ABCD2345`,
    );
    // Билет выписан именно на привязку и от лица сессии сайта. `provider` —
    // способ входа ИСТОЧНИКА (по нему сервер находит строку AuthProvider и
    // показывает подтверждающему, чей аккаунт переезжает), а не 'telegram':
    // тот принадлежит подтверждающей стороне.
    const [path, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/auth/ticket/start');
    expect(JSON.parse(init.body as string)).toEqual({
      intent: 'link',
      provider: 'google',
      hostId: 'web',
    });
  });

  it('вход через ВКонтакте — билет называет источником vk, ссылка та же', async () => {
    renderSection([provider('vk')]);

    const link = await findLink();
    expect(link.getAttribute('href')).toBe(
      `https://t.me/${botUsername}?start=link_ABCD2345`,
    );
    const [, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).provider).toBe('vk');
  });

  it('Telegram уже привязан — не показывает ничего и не тратит билет', async () => {
    const { container } = renderSection([
      provider('google'),
      provider('telegram'),
    ]);

    await waitFor(() => expect(mockedFetch).not.toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('MAX уже привязан — собирать нечего, карточки нет', async () => {
    const { container } = renderSection([provider('max')]);

    await waitFor(() => expect(mockedFetch).not.toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('провайдеры ещё грузятся — силуэт карточки, а не спиннер и не пустота', () => {
    const { container } = render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <AccountLinkSection providers={[]} loading onLinked={vi.fn()} />
      </AddressFormContext.Provider>,
    );

    expect(container.querySelectorAll('.skel').length).toBeGreaterThan(0);
    expect(container.querySelector('.spinner')).toBeNull();
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe('AccountLinkSection — событие и сбой', () => {
  it('нажатие на ссылку шлёт account_link_started ровно один раз', async () => {
    renderSection([provider('google')]);
    const link = await findLink();

    // Событие уходит НА НАЖАТИЕ: считай мы его при выписке билета, метрика
    // мерила бы открытия кабинета.
    expect(mockedApi.trackEvent).not.toHaveBeenCalled();

    fireEvent.click(link);

    expect(mockedApi.trackEvent).toHaveBeenCalledTimes(1);
    expect(mockedApi.trackEvent).toHaveBeenCalledWith('account_link_started', {
      host: 'web',
    });
  });

  it('после нажатия показывает код для сверки с ботом', async () => {
    renderSection([provider('google')]);
    fireEvent.click(await findLink());

    expect(screen.getByText('ABCD-2345')).toBeTruthy();
  });

  it('билет не выписался (сеть, 429 от троттлинга) — предлагает начать заново', async () => {
    mockedFetch.mockResolvedValue(jsonResponse(429, {}));
    renderSection([provider('email')]);

    await screen.findByText('Начать заново');
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('AccountLinkSection — форма обращения', () => {
  it('форма «ты» — ни одной «вы»-строки', async () => {
    const { container } = renderSection([provider('google')], 'ty');
    await findLink();

    const text = container.textContent ?? '';
    expect(text).toContain('точно ли это ты');
    expect(text).not.toContain('точно ли это вы');
    expect(text).not.toMatch(/Подключите|Нажмёте|Подтвердите|Сверьте/);
  });

  it('форма «вы» — ни одной «ты»-строки', async () => {
    const { container } = renderSection([provider('google')], 'vy');
    await findLink();

    const text = container.textContent ?? '';
    expect(text).toContain('точно ли это вы');
    expect(text).not.toContain('точно ли это ты');
    expect(text).not.toMatch(/Нажмёшь|Подтвердишь|Подключи Telegram, и/);
  });

  it('форма «вы» — экран сверки кода тоже во «вы»', async () => {
    const { container } = renderSection([provider('google')], 'vy');
    fireEvent.click(await findLink());

    const text = container.textContent ?? '';
    expect(text).toMatch(/Сверьте|подтвердите/);
    expect(text).not.toMatch(/Сверь его|подтверди,/);
  });
});
