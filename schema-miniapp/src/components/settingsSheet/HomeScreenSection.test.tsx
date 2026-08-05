// @vitest-environment jsdom
// HomeScreenSection — блок настроек «значок на экран». Гейт видимости
// зависит от хоста (та же логика, что useHomeScreenOffer): в браузере и на
// площадках без нативного addToHomeScreen секция не показывается вовсе, а
// не рисует мёртвую кнопку.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { setHost } from '../../../../shared/src/host';
import { HomeScreenSection } from './HomeScreenSection';

beforeEach(() => {
  setHost(null);
  delete (globalThis as { Telegram?: unknown }).Telegram;
});

afterEach(() => {
  cleanup();
});

describe('HomeScreenSection — гейт видимости', () => {
  it('в браузере (нет нативного addToHomeScreen) — секция скрыта', () => {
    const { container } = render(<HomeScreenSection />);
    expect(container.firstChild).toBeNull();
  });

  it('в Telegram на Android — секция видна с подсказкой под кнопкой', () => {
    (globalThis as { Telegram?: unknown }).Telegram = {
      WebApp: {
        platform: 'android',
        initData: 'hash=abc',
        addToHomeScreen: () => {},
      },
    };
    render(<HomeScreenSection />);
    expect(screen.getByText('ЗНАЧОК НА ЭКРАНЕ')).toBeTruthy();
    expect(screen.getByText('Добавить значок на экран')).toBeTruthy();
    expect(screen.getByText(/Telegram спросит подтверждение/)).toBeTruthy();
  });

  it('в Telegram на iOS — своя подсказка про «Поделиться»', () => {
    (globalThis as { Telegram?: unknown }).Telegram = {
      WebApp: {
        platform: 'ios',
        initData: 'hash=abc',
        addToHomeScreen: () => {},
      },
    };
    render(<HomeScreenSection />);
    expect(screen.getByText(/следуй инструкции/)).toBeTruthy();
  });
});
