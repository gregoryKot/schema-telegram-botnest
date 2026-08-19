// @vitest-environment jsdom
// Баннер «приложение для телефона»: ведёт в /app/, скрывается навсегда через
// localStorage, оба действия трекаются (web_banner_open/dismiss, banner:
// mobile_app — id в бэковом allow-list WEB_BANNER_IDS).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

import { api } from '../api';
import { MobileAppBanner } from './MobileAppBanner';

const DISMISS_KEY = 'web_banner_dismissed:mobile_app';

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.trackEvent).mockClear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('MobileAppBanner', () => {
  it('показывается по умолчанию, ссылка ведёт в /app/', () => {
    render(<MobileAppBanner />);
    expect(screen.getByText('Приложение для телефона')).toBeTruthy();
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

  it('крестик скрывает баннер, пишет localStorage и трекает dismiss', () => {
    render(<MobileAppBanner />);
    fireEvent.click(screen.getByLabelText('Скрыть баннер'));
    expect(screen.queryByText('Приложение для телефона')).toBeNull();
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
});
