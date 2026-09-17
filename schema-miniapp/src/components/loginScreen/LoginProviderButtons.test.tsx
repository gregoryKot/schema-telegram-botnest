// @vitest-environment jsdom
// Вход из установленного приложения. Главное, что здесь держится тестами:
// приложение НЕ уходит подтверждать вход само (иначе сессия достанется
// внешнему браузеру, и с ярлыка войти нельзя в принципе) — оно открывает
// подтверждение снаружи и забирает сессию опросом.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

// vi.mock поднимается наверх файла — фабрики не имеют права ссылаться на
// обычные переменные модуля. vi.hoisted поднимается вместе с ними.
const { startMock, pollMock, adoptMock } = vi.hoisted(() => ({
  startMock: vi.fn(),
  pollMock: vi.fn(),
  adoptMock: vi.fn(),
}));

vi.mock('../../../../shared/src/auth/loginTicketApi', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  createLoginTicketApi: () => ({ start: startMock, poll: pollMock }),
}));
vi.mock('../../session', () => ({ adoptSession: adoptMock }));

import { LoginProviderButtons } from './LoginProviderButtons';

beforeEach(() => {
  startMock.mockReset().mockResolvedValue({
    deviceCode: 'd'.repeat(64),
    userCode: 'K7M2QX94',
    expiresIn: 300,
    interval: 3,
  });
  pollMock.mockReset().mockResolvedValue({ status: 'pending' });
  adoptMock.mockReset();
});
afterEach(cleanup);

async function renderReady() {
  render(<LoginProviderButtons />);
  await waitFor(() => expect(screen.getByText('K7M2-QX94')).toBeTruthy());
}

describe('кнопки входа', () => {
  it('билет выписывается сразу — по ссылке жмут ОДИН раз, а не два', async () => {
    await renderReady();
    expect(startMock).toHaveBeenCalledWith({
      intent: 'login',
      provider: 'telegram',
      hostId: 'web',
    });
  });

  it('Telegram ведёт в бота с кодом в payload', async () => {
    await renderReady();
    const link = screen.getByRole('link', { name: 'Войти через Telegram' });
    expect(link.getAttribute('href')).toContain('?start=login_K7M2QX94');
  });

  it('Google и ВКонтакте несут тот же код билета', async () => {
    await renderReady();
    expect(
      screen
        .getByRole('link', { name: 'Войти через Google' })
        .getAttribute('href'),
    ).toBe('/api/auth/google?ticket=K7M2QX94');
    expect(
      screen
        .getByRole('link', { name: 'Войти через ВКонтакте' })
        .getAttribute('href'),
    ).toBe('/api/auth/vk?ticket=K7M2QX94');
  });

  it('все ссылки открываются СНАРУЖИ — приложение обязано остаться живым', async () => {
    await renderReady();
    for (const name of ['Войти через Telegram', 'Войти через Google']) {
      expect(screen.getByRole('link', { name }).getAttribute('target')).toBe(
        '_blank',
      );
    }
  });

  it('код на экране виден — его сверяют с тем, что покажет бот', async () => {
    await renderReady();
    expect(screen.getByText('K7M2-QX94')).toBeTruthy();
  });
});

describe('исход входа', () => {
  it('подтвердили — сессия принимается ЭТИМ контейнером', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
    });
    pollMock.mockResolvedValue({
      status: 'linked',
      accessToken: 'a',
      expiresIn: 900,
    });

    render(<LoginProviderButtons />);
    await vi.advanceTimersByTimeAsync(4000);

    await waitFor(() => expect(adoptMock).toHaveBeenCalledWith('a', 900));
    vi.useRealTimers();
  });

  it('сервер не дал билет — экран говорит об этом, а не молчит', async () => {
    startMock.mockRejectedValue(new Error('нет сети'));
    render(<LoginProviderButtons />);
    await waitFor(() =>
      expect(screen.getByText(/Не получилось начать вход/)).toBeTruthy(),
    );
  });
});
