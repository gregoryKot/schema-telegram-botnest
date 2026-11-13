// @vitest-environment jsdom
// Приглашение добавить почту или VK ID: видно только внутри Telegram и только
// тому, у кого других способов входа нет; действие одно; «Позже» — на неделю.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const hostId = vi.hoisted(() => ({ current: 'telegram' }));
vi.mock('../../../shared/src/host', () => ({ getHost: () => ({ id: hostId.current }) }));
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));
vi.mock('../auth/authContext', () => ({ useAuth: () => ({ accessToken: 't' }) }));

import { api } from '../api';
import { AddressFormContext } from '../utils/addressForm';
import { SiteAccessCard } from './SiteAccessCard';

const fetchMock = vi.fn();
const me = (providers: string[]) =>
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ providers: providers.map((provider) => ({ provider, email: null, displayName: null })) }),
  });

function show(form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter initialEntries={['/more']}>
        <Routes>
          <Route path="/more" element={<SiteAccessCard />} />
          <Route path="/account" element={<div>экран способов входа</div>} />
        </Routes>
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}
const ACTION = 'Добавить почту или VK ID';
// Полный прогон грузит машину: секунды по умолчанию на ответ /api/auth/me не хватает.
const SLOW = { timeout: 5000 };

beforeEach(() => {
  hostId.current = 'telegram';
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('SiteAccessCard', () => {
  it('только Telegram: говорит, откуда и зачем, и ведёт на экран способов входа', async () => {
    me(['telegram']);
    show();
    await screen.findByText('Добавь вход для сайта', {}, SLOW);
    expect(screen.getByText(/вход через Telegram закрыт — туда входят почтой или VK ID/)).toBeTruthy();
    await waitFor(() => expect(api.trackEvent).toHaveBeenCalledWith('login_method_offer', { action: 'shown' }), SLOW);

    fireEvent.click(screen.getByRole('button', { name: ACTION }));
    expect(api.trackEvent).toHaveBeenCalledWith('login_method_offer', { action: 'open' });
    expect(await screen.findByText('экран способов входа', {}, SLOW)).toBeTruthy();
  });

  it('форма «вы» — во множественном числе', async () => {
    me(['telegram']);
    const { container } = show('vy');
    await screen.findByText('Добавьте вход для сайта', {}, SLOW);
    // EntitySheet клеит короткие слова неразрывным пробелом — сравниваем без него.
    const text = (container.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(text).toContain('Добавьте один из них');
    expect(text).not.toMatch(/Добавь (вход|один)/);
  });

  it.each([[['telegram', 'email']], [['telegram', 'vk']]])('уже есть чем войти на сайт (%j) — карточки нет', async (providers) => {
    me(providers);
    const { container } = show();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), SLOW);
    await Promise.resolve();
    expect(container.textContent).toBe('');
    expect(api.trackEvent).not.toHaveBeenCalled();
  });

  it.each(['web', 'max'])('хост %s — карточки нет и способы входа не запрашиваются', (id) => {
    hostId.current = id;
    me(['telegram']);
    const { container } = show();
    expect(container.textContent).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ответ ещё не пришёл или сервер не ответил — ничего не выдумываем', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) });
    const { container } = show();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), SLOW);
    expect(container.textContent).toBe('');
  });

  it('«Позже» прячет карточку и не показывает её при следующем открытии', async () => {
    me(['telegram']);
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Позже' }, SLOW));
    expect(screen.queryByRole('button', { name: ACTION })).toBeNull();
    expect(api.trackEvent).toHaveBeenCalledWith('login_method_offer', { action: 'later' });

    cleanup();
    vi.mocked(api.trackEvent).mockClear();
    const { container } = show();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), SLOW);
    await Promise.resolve();
    expect(container.textContent).toBe('');
    expect(api.trackEvent).not.toHaveBeenCalled();
  });
});
