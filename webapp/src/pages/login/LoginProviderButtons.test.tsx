// @vitest-environment jsdom
// Способы входа на странице /login: ВКонтакте и Яндекс (во вкладке — прямой
// вход, в установленном приложении — по билету из общего хука shared). Входа
// через Telegram на сайте нет — это и проверяется первым.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

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
const YANDEX = /Войти через Яндекс/;

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

// Яндекс ID (2026-11) — второй сервис входа, зеркало ВКонтакте: свой маршрут
// бэкенда `/api/auth/yandex`, та же кнопка, тот же билет.
describe('Яндекс', () => {
  it('кнопка стоит сразу после ВКонтакте, знак — «Я», скрытый от читалки', () => {
    render(<LoginProviderButtons onSession={vi.fn()} />);
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['VKВойти через ВКонтакте', 'ЯВойти через Яндекс']);
    // Иначе читалка произнесла бы «Я войти через Яндекс».
    expect(screen.getByRole('link', { name: 'Войти через Яндекс' })).toBe(links[1]);
    expect(links.map((a) => a.className)).toEqual(['al-btn-main', 'al-btn-main']);
  });

  it('во вкладке браузера — прямой вход в той же вкладке, без билета', () => {
    render(<LoginProviderButtons onSession={vi.fn()} />);
    const ya = screen.getByRole('link', { name: YANDEX });
    expect(ya.getAttribute('href')).toBe('/api/auth/yandex');
    expect(ya.getAttribute('target')).toBeNull();
    expect(startMock).not.toHaveBeenCalled();
  });

  it('в установленном приложении несёт код того же билета и открывается снаружи', async () => {
    standalone();
    render(<LoginProviderButtons onSession={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: YANDEX }).getAttribute('href')).toBe(
        '/api/auth/yandex?ticket=K7M2QX94',
      ),
    );
    expect(screen.getByRole('link', { name: YANDEX }).getAttribute('target')).toBe('_blank');
    // Второго билета нет: код у обеих кнопок один, подтверждает его вошедший человек.
    expect(screen.getByRole('link', { name: VK }).getAttribute('href')).toBe('/api/auth/vk?ticket=K7M2QX94');
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  // Билет выписан до нажатия, поэтому сервис ожидания — тот, чью кнопку нажали:
  // иначе после входа через Яндекс экран звал бы подтвердить «через ВКонтакте»
  // и «Открыть ещё раз» вело бы на чужой сервис.
  it.each([
    ['Яндекс', YANDEX, '/api/auth/yandex?ticket=K7M2QX94'],
    ['ВКонтакте', VK, '/api/auth/vk?ticket=K7M2QX94'],
  ] as const)('ожидание называет нажатый сервис: %s', async (name, button, url) => {
    standalone();
    render(<LoginProviderButtons onSession={vi.fn()} />);
    const link = await screen.findByRole('link', { name: button });
    await waitFor(() => expect(link.getAttribute('href')).toContain('ticket='));
    link.addEventListener('click', (e) => e.preventDefault()); // jsdom не умеет открывать окна
    fireEvent.click(link);
    fireEvent.click(screen.getByRole('button', { name: 'Показать код входа' }));
    expect(screen.getByText(`Осталось подтвердить вход через ${name}. Код входа:`)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Открыть ещё раз/ }).getAttribute('href')).toBe(url);
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

  // Аудит b26: сбой билета стоял часами-эмодзи посреди формы — теперь лист сбоя с повтором.
  it('билет не выписался — сбой листом с повтором на месте кнопки, повтор возвращает ВКонтакте', async () => {
    startMock.mockReset().mockRejectedValue(new Error('500'));
    render(<LoginProviderButtons onSession={vi.fn()} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не\sполучилось начать вход/);
    expect(alert.textContent).not.toMatch(/[⌛🛑]/u);
    // Без кода билета ссылке вести некуда — кнопки нет, пока билет не выписан.
    expect(screen.queryByRole('link', { name: /Войти через ВКонтакте/ })).toBeNull();
    startMock.mockResolvedValue({ deviceCode: 'd'.repeat(64), userCode: 'K7M2QX94', expiresIn: 300, interval: 3 });
    screen.getByRole('button', { name: 'Попробовать снова' }).click();
    await waitFor(() => expect(screen.getByRole('link', { name: /Войти через ВКонтакте/ })).toBeTruthy());
  });
});
