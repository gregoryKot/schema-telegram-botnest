// @vitest-environment jsdom
// Вход на сайте по билету. Та же механика, что у мини-аппа (общий хук в
// shared) — здесь проверяется, что сайт её действительно использует, а не
// остался на прежнем редиректе: именно на сайте жила жалоба «Telegram
// получается только со второй попытки».
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

async function renderReady(onSession = vi.fn()) {
  render(<LoginProviderButtons onSession={onSession} />);
  // Билет выписан — код уже в ссылке Telegram (на экране он свёрнут).
  await waitFor(() =>
    expect(
      screen
        .getByRole('link', { name: /Войти через Telegram/ })
        .getAttribute('href'),
    ).toContain('login_K7M2QX94'),
  );
  return onSession;
}

describe('способы входа', () => {
  it('Telegram ведёт в бота, а не на oauth.telegram.org', async () => {
    await renderReady();
    const href = screen
      .getByRole('link', { name: /Войти через Telegram/ })
      .getAttribute('href');
    expect(href).toContain('t.me/');
    expect(href).toContain('start=login_K7M2QX94');
    expect(href).not.toContain('oauth.telegram.org');
  });

  // 2026-10-03: во вкладке браузера билет для Google/VK не нужен — кука
  // общая. По билету вход уходил в новое окно и кончался экраном «это вы?» с
  // кодом, что владелец принял за поломку.
  it('во вкладке браузера Google и ВКонтакте — прямой вход в той же вкладке, без билета', async () => {
    await renderReady();
    const google = screen.getByRole('link', { name: /Войти через Google/ });
    const vk = screen.getByRole('link', { name: /Войти через ВКонтакте/ });
    expect(google.getAttribute('href')).toBe('/api/auth/google');
    expect(vk.getAttribute('href')).toBe('/api/auth/vk');
    expect(google.getAttribute('target')).toBeNull();
    expect(vk.getAttribute('target')).toBeNull();
  });

  it('в установленном приложении Google и ВКонтакте несут код билета и открываются снаружи', async () => {
    const matchMedia = vi.fn((q: string) => ({
      matches: q === '(display-mode: standalone)',
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      await renderReady();
      const google = screen.getByRole('link', { name: /Войти через Google/ });
      expect(google.getAttribute('href')).toBe('/api/auth/google?ticket=K7M2QX94');
      expect(google.getAttribute('target')).toBe('_blank');
      expect(
        screen
          .getByRole('link', { name: /Войти через ВКонтакте/ })
          .getAttribute('href'),
      ).toBe('/api/auth/vk?ticket=K7M2QX94');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('Telegram открывается снаружи — страница остаётся ждать сессию', async () => {
    await renderReady();
    expect(
      screen.getByRole('link', { name: /Войти через Telegram/ }).getAttribute('target'),
    ).toBe('_blank');
  });

  it('билет выписывается один раз при открытии экрана', async () => {
    await renderReady();
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledWith({
      intent: 'login',
      provider: 'telegram',
      hostId: 'web',
    });
  });
});

describe('исход', () => {
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
