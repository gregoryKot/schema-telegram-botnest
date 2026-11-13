// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../auth/authContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api', () => ({
  api: {
    trackPublicEvent: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({ addressForm: 'vy' }),
  },
  reportClientError: vi.fn(),
}));
vi.mock('../apiClient', () => ({ authedFetch: vi.fn() }));
const poll = vi.fn();
vi.mock('../../../shared/src/auth/loginTicketApi', () => ({
  createLoginTicketApi: () => ({ poll, start: vi.fn() }),
}));

import { useAuth } from '../auth/authContext';
import { api } from '../api';
import { authedFetch } from '../apiClient';
import { InstallPage } from './InstallPage';
import { installTelegram, removeTelegram } from '../host/tgStub.test-helpers';
import { _resetInstallPromptForTests } from '../utils/pwaInstall';

const CODE = 'ab12'.repeat(16);
const setAccessToken = vi.fn();

function setAuth(over: Record<string, unknown> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    setAccessToken,
    ...over,
  } as never);
}

const renderPage = () =>
  render(<MemoryRouter><InstallPage /></MemoryRouter>);

const events = () => vi.mocked(api.trackPublicEvent).mock.calls.map(([, m]) => (m as { action: string }).action);

function stubUa(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';

function catchInstallPrompt() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const ev = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' as const }),
  });
  window.dispatchEvent(ev);
  return prompt;
}

beforeEach(() => {
  _resetInstallPromptForTests();
  setAuth();
  poll.mockReset();
  window.history.replaceState(null, '', '/install');
});
afterEach(() => {
  cleanup();
  removeTelegram();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('InstallPage — передача сессии', () => {
  it('код в хеше: poll с кодом, фрагмент стёрт, токен выставлен, событие handoff_ok', async () => {
    poll.mockResolvedValue({ status: 'linked', accessToken: 'tok', expiresIn: 900 });
    window.history.replaceState(null, '', `/install#h=${CODE}`);
    renderPage();
    await waitFor(() => expect(setAccessToken).toHaveBeenCalledWith('tok', 900));
    expect(poll).toHaveBeenCalledWith(CODE);
    expect(window.location.hash).toBe('');
    expect(events()).toContain('handoff_ok');
  });

  it('expired: handoff_failed, страница остаётся анонимной с шагами', async () => {
    poll.mockResolvedValue({ status: 'expired' });
    window.history.replaceState(null, '', `/install#h=${CODE}`);
    renderPage();
    await waitFor(() => expect(events()).toContain('handoff_failed'));
    expect(setAccessToken).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.ib-steps li').length).toBeGreaterThan(0);
  });

  it('сетевая ошибка poll — handoff_failed', async () => {
    poll.mockRejectedValue(new Error('сеть'));
    window.history.replaceState(null, '', `/install#h=${CODE}`);
    renderPage();
    await waitFor(() => expect(events()).toContain('handoff_failed'));
  });

  it('уже авторизован: poll не зовётся, фрагмент всё равно стёрт', async () => {
    setAuth({ isAuthenticated: true });
    window.history.replaceState(null, '', `/install#h=${CODE}`);
    renderPage();
    await act(async () => { await Promise.resolve(); });
    expect(poll).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('пока сессия проверяется — ждёт', async () => {
    setAuth({ isLoading: true });
    window.history.replaceState(null, '', `/install#h=${CODE}`);
    renderPage();
    await act(async () => { await Promise.resolve(); });
    expect(poll).not.toHaveBeenCalled();
  });

  it('без кода — poll не зовётся', async () => {
    renderPage();
    await act(async () => { await Promise.resolve(); });
    expect(poll).not.toHaveBeenCalled();
  });
});

describe('InstallPage — экраны', () => {
  it('основной экран: заголовок, шаги, событие shown один раз', () => {
    stubUa(IPHONE);
    const { rerender } = renderPage();
    rerender(<MemoryRouter><InstallPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('на телефоне');
    expect(document.querySelectorAll('.ib-steps li').length).toBe(3);
    expect(screen.getByText(/Откройте её в Chrome \(iPhone — в Safari\)/)).toBeTruthy();
    expect(screen.getByText(/Входите почтой, VK ID или Яндекс ID/)).toBeTruthy();
    expect(events().filter((a) => a === 'shown')).toHaveLength(1);
    expect(document.title).toBe('Установить приложение — Всё по схеме');
  });

  it('Android WebView: подсказка про браузер стоит выше шагов', () => {
    stubUa(`${ANDROID.replace('Pixel 7)', 'Pixel 7; wv)')}`);
    const { container } = renderPage();
    const hint = container.querySelector('.ip-hint')!;
    const steps = container.querySelector('.ib-steps')!;
    expect(hint.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Android аноним: вход после установки; авторизованный — данные на месте', () => {
    stubUa(ANDROID);
    renderPage();
    expect(screen.getByText(/Вход — после установки/)).toBeTruthy();
    cleanup();
    setAuth({ isAuthenticated: true });
    renderPage();
    expect(screen.getByText(/Вход уже выполнен/)).toBeTruthy();
  });

  it('canPrompt: кнопка зовёт prompt и шлёт add; accepted → экран «Готово»', async () => {
    stubUa(ANDROID);
    const prompt = catchInstallPrompt();
    renderPage();
    expect(document.querySelector('.ib-steps')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Установить приложение' })); });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(events()).toContain('add');
    await waitFor(() => expect(screen.getByText('Готово')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Открыть приложение' }).getAttribute('href')).toBe('/today');
  });

  it('appinstalled: экран «Готово» и событие added', () => {
    renderPage();
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(screen.getByText('Готово')).toBeTruthy();
    expect(events()).toContain('added');
  });

  it('standalone: «уже установлено» и ссылка в /today', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone'), addEventListener: () => {}, removeEventListener: () => {} }));
    renderPage();
    expect(screen.getByText('Приложение уже установлено')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Открыть' }).getAttribute('href')).toBe('/today');
    expect(events()).not.toContain('shown');
  });

  it('внутри Telegram: «Открыть в браузере» ведёт на /install', () => {
    installTelegram({ platform: 'ios' });
    vi.mocked(authedFetch).mockResolvedValue({ ok: false, status: 500 } as Response);
    renderPage();
    const a = screen.getByRole('link', { name: 'Открыть в браузере' });
    expect(a.getAttribute('href')).toMatch(/\/install(#h=[0-9a-f]{64})?$/);
    expect(events()).not.toContain('shown');
  });
});

// S15 (аудит 2026-11): после передачи сессии на публичной /install тег Метрики
// уже стоит в документе; SPA-переход в кабинет оставил бы tag.js на клинических
// экранах. С загруженным тегом — только полная навигация (location.assign).
describe('InstallPage — Метрика не переезжает в кабинет', () => {
  afterEach(() => { delete (window as { __ym_loaded?: boolean }).__ym_loaded; });

  async function handoffThenInstalled() {
    poll.mockResolvedValue({ status: 'linked', accessToken: 'tok', expiresIn: 900 });
    window.history.replaceState(null, '', `/install#h=${CODE}`);
    renderPage();
    await waitFor(() => expect(setAccessToken).toHaveBeenCalledWith('tok', 900));
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    return assign;
  }

  it('после обмена кода при загруженной Метрике «Открыть приложение» — полная навигация', async () => {
    (window as { __ym_loaded?: boolean }).__ym_loaded = true;
    const assign = await handoffThenInstalled();
    fireEvent.click(screen.getByRole('link', { name: 'Открыть приложение' }));
    expect(assign).toHaveBeenCalledWith('/today');
  });

  it('контроль: тега Метрики в документе нет — обычный SPA-переход, без перезагрузки', async () => {
    const assign = await handoffThenInstalled();
    fireEvent.click(screen.getByRole('link', { name: 'Открыть приложение' }));
    expect(assign).not.toHaveBeenCalled();
  });
});
