// @vitest-environment jsdom
// Способы входа на странице /login: ВКонтакте (во вкладке — прямой вход, в
// установленном приложении — по билету из общего хука shared). Входа через
// Telegram на сайте нет — это и проверяется первым.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const { startMock, pollMock } = vi.hoisted(() => ({
  startMock: vi.fn(),
  pollMock: vi.fn(),
}));

vi.mock('../../../../shared/src/auth/loginTicketApi', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  createLoginTicketApi: () => ({ start: startMock, poll: pollMock }),
}));

import { LoginProviderButtons } from './LoginProviderButtons';

beforeEach(() => {
  startMock.mockReset().mockResolvedValue({
    deviceCode: 'd'.repeat(64),
    userCode: 'K7M2QX94',
    expiresIn: 300,
    interval: 3,
  });
  pollMock.mockReset().mockResolvedValue({ status: 'pending' });
});
afterEach(cleanup);

const VK = /Войти через ВКонтакте/;

function standalone() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({ matches: q === '(display-mode: standalone)' })),
  );
}
afterEach(() => vi.unstubAllGlobals());

describe('способы входа', () => {
  // Запрос РКН №08-1063539 (2026-11): пользователей из России нельзя
  // авторизовать на сайте через иностранный сервис. Ни кнопки Telegram, ни
  // ссылки в бота, ни oauth.telegram.org — и в браузере, и в приложении с
  // экрана «Домой».
  it.each([['вкладка браузера', false], ['установленное приложение', true]])(
    '%s: входа через Telegram и Google нет',
    async (_name, pwa) => {
      if (pwa) standalone();
      render(<LoginProviderButtons onSession={vi.fn()} />);
      if (pwa)
        await waitFor(() =>
          expect(screen.getByRole('link', { name: VK }).getAttribute('href')).toContain('ticket='),
        );
      expect(screen.queryByRole('link', { name: /Telegram/ })).toBeNull();
      expect(document.body.innerHTML).not.toMatch(/telegram|t\.me|login_|google/i);
    },
  );

  // 2026-10-03: во вкладке браузера билет для VK не нужен — кука общая. По
  // билету вход уходил в новое окно и кончался экраном «это вы?» с кодом, что
  // владелец принял за поломку.
  it('во вкладке браузера ВКонтакте — прямой вход в той же вкладке, без билета', () => {
    render(<LoginProviderButtons onSession={vi.fn()} />);
    const vk = screen.getByRole('link', { name: VK });
    expect(vk.getAttribute('href')).toBe('/api/auth/vk');
    expect(vk.getAttribute('target')).toBeNull();
    expect(startMock).not.toHaveBeenCalled();
  });

  it('в установленном приложении ВКонтакте несёт код билета и открывается снаружи', async () => {
    standalone();
    render(<LoginProviderButtons onSession={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: VK }).getAttribute('href')).toBe(
        '/api/auth/vk?ticket=K7M2QX94',
      ),
    );
    expect(screen.getByRole('link', { name: VK }).getAttribute('target')).toBe('_blank');
    // Билет один на экран и выписан под ВКонтакте — под Telegram сервер его не даст.
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledWith({ intent: 'login', provider: 'vk', hostId: 'web' });
  });
});

describe('исход (установленное приложение)', () => {
  beforeEach(standalone);

  it('подтверждён — сессия уходит наверх', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    pollMock.mockResolvedValue({
      status: 'linked',
      accessToken: 'a',
      expiresIn: 900,
    });
    const onSession = vi.fn();
    render(<LoginProviderButtons onSession={onSession} />);

    await vi.advanceTimersByTimeAsync(4000);
    await waitFor(() => expect(onSession).toHaveBeenCalledWith('a', 900));
    vi.useRealTimers();
  });

  it('«это не я» — экран говорит, что доступ никто не получил', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    pollMock.mockResolvedValue({ status: 'denied' });
    render(<LoginProviderButtons onSession={vi.fn()} />);

    await vi.advanceTimersByTimeAsync(4000);
    await waitFor(() =>
      expect(screen.getByText(/Доступ никто не получил/)).toBeTruthy(),
    );
    vi.useRealTimers();
  });
});
