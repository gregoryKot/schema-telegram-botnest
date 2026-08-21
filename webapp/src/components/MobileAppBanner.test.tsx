// @vitest-environment jsdom
// Баннер «приложение для телефона»: ведёт в /app/, разворачивает инструкцию
// «значок на экран», скрывается навсегда через localStorage и не показывается
// внутри уже установленного приложения. Аналитика: web_banner_open/dismiss
// (banner: mobile_app) + home_screen_offer (surface: site_banner).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

import { api } from '../api';
import { MobileAppBanner } from './MobileAppBanner';
import { _resetInstallPromptForTests } from '../utils/pwaInstall';

const DISMISS_KEY = 'web_banner_dismissed:mobile_app';

beforeEach(() => {
  localStorage.clear();
  _resetInstallPromptForTests();
  vi.mocked(api.trackEvent).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('MobileAppBanner', () => {
  it('показывается по умолчанию: иконка, имя, ссылка в /app/', () => {
    render(<MobileAppBanner />);
    expect(screen.getByText('Всё по схеме')).toBeTruthy();
    expect(screen.getByText('приложение для телефона')).toBeTruthy();
    const cta = screen.getByText('Открыть приложение') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/app/');
  });

  it('клик по ссылке трекает web_banner_open с banner: mobile_app', () => {
    render(<MobileAppBanner />);
    const cta = screen.getByText('Открыть приложение');
    // jsdom не умеет настоящую навигацию — гасим переход, клик остаётся
    cta.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(cta);
    expect(api.trackEvent).toHaveBeenCalledWith('web_banner_open', {
      banner: 'mobile_app',
    });
  });

  it('«Значок на экран» разворачивает инструкцию и трекает shown/site_banner', () => {
    render(<MobileAppBanner />);
    expect(screen.queryByText('В Chrome или Яндекс Браузере:')).toBeNull();
    fireEvent.click(screen.getByText(/Значок на экран/));
    // jsdom без UA телефона → платформа desktop, шаги для компьютера
    expect(screen.getByText('В Chrome или Яндекс Браузере:')).toBeTruthy();
    expect(api.trackEvent).toHaveBeenCalledWith('home_screen_offer', {
      action: 'shown',
      surface: 'site_banner',
    });
    // Повторный клик сворачивает и второй раз shown не шлёт
    fireEvent.click(screen.getByText(/Значок на экран/));
    expect(screen.queryByText('В Chrome или Яндекс Браузере:')).toBeNull();
    expect(
      vi.mocked(api.trackEvent).mock.calls.filter(([n]) => n === 'home_screen_offer'),
    ).toHaveLength(1);
  });

  it('крестик скрывает баннер, пишет localStorage и трекает dismiss', () => {
    render(<MobileAppBanner />);
    fireEvent.click(screen.getByLabelText('Скрыть баннер'));
    expect(screen.queryByText('приложение для телефона')).toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
    expect(api.trackEvent).toHaveBeenCalledWith('web_banner_dismiss', {
      banner: 'mobile_app',
    });
  });

  it('однажды скрытый — больше не показывается', () => {
    localStorage.setItem(DISMISS_KEY, '1');
    const { container } = render(<MobileAppBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('открыто как установленное приложение (standalone) — баннера нет', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone') }));
    const { container } = render(<MobileAppBanner />);
    expect(container.firstChild).toBeNull();
  });
});
