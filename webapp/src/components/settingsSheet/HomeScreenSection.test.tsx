// @vitest-environment jsdom
// «Значок на экране» в настройках сайта: в мессенджере — та же кнопка, что у
// карточки на «Сегодня» (shared AddHomeScreenButton), в браузере — установка PWA.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { HomeScreenSection } from './HomeScreenSection';
import { installTelegram, removeTelegram } from '../../host/tgStub.test-helpers';
import { _resetInstallPromptForTests } from '../../utils/pwaInstall';

afterEach(() => {
  cleanup();
  removeTelegram();
  _resetInstallPromptForTests();
  vi.restoreAllMocks();
});

describe('HomeScreenSection — внутри мессенджера', () => {
  it('Android: кнопка зовёт нативный addToHomeScreen, подсказка про подтверждение', () => {
    const addToHomeScreen = vi.fn();
    installTelegram({ platform: 'android', addToHomeScreen });
    render(<HomeScreenSection mode="messenger" />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить значок на экран' }));
    expect(addToHomeScreen).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Telegram спросит подтверждение/)).toBeTruthy();
  });

  it('iOS: настоящая ссылка на прыжковую страницу', () => {
    installTelegram({ platform: 'ios', addToHomeScreen: vi.fn() });
    render(<HomeScreenSection mode="messenger" />);
    const a = screen.getByRole('link', { name: 'Добавить значок на экран' });
    expect(a.getAttribute('href')).toMatch(/add-icon\.html$/);
    expect(screen.getByText(/следуй инструкции/)).toBeTruthy();
  });
});

describe('HomeScreenSection — в браузере', () => {
  it('нет нативного промпта — шаги установки для платформы', () => {
    render(<HomeScreenSection mode="browser" />);
    expect(screen.getByText(/Сайт ставится как приложение/)).toBeTruthy();
    expect(screen.queryByText('Установить приложение')).toBeNull();
    expect(document.querySelectorAll('.st-steps li').length).toBeGreaterThan(0);
  });

  it('есть пойманный beforeinstallprompt — кнопка «Установить приложение» зовёт prompt()', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const ev = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    window.dispatchEvent(ev);
    render(<HomeScreenSection mode="browser" />);
    const btn = screen.getByRole('button', { name: 'Установить приложение' });
    await act(async () => { fireEvent.click(btn); });
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('после appinstalled — «Готово», кнопок и шагов больше нет', () => {
    render(<HomeScreenSection mode="browser" />);
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(screen.getByText(/Готово: значок появился/)).toBeTruthy();
    expect(document.querySelectorAll('.st-steps').length).toBe(0);
  });
});
