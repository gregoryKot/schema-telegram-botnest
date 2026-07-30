// @vitest-environment jsdom
// Клик по кнопке провайдера обязан положить auth_return_to ДО перехода —
// иначе после входа человека выкидывает на сайт, а не в /app/ (см.
// webapp/src/pages/AuthCallback.tsx, который читает этот же ключ).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LoginProviderButtons } from './LoginProviderButtons';

const originalLocation = window.location;

function stubLocation() {
  let href = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      set href(v: string) {
        href = v;
      },
      get href() {
        return href;
      },
    },
  });
}

beforeEach(() => {
  cleanup();
  sessionStorage.clear();
  stubLocation();
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

describe('LoginProviderButtons', () => {
  it('Telegram: кладёт auth_return_to=/app/ и ведёт на /api/auth/telegram/redirect', () => {
    render(<LoginProviderButtons />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Войти через Telegram' }),
    );
    expect(sessionStorage.getItem('auth_return_to')).toBe('/app/');
    expect(window.location.href).toBe('/api/auth/telegram/redirect');
  });

  it('Google: тот же return_to, ведёт на /api/auth/google', () => {
    render(<LoginProviderButtons />);
    fireEvent.click(screen.getByRole('button', { name: 'Войти через Google' }));
    expect(sessionStorage.getItem('auth_return_to')).toBe('/app/');
    expect(window.location.href).toBe('/api/auth/google');
  });

  it('ВКонтакте: тот же return_to, ведёт на /api/auth/vk', () => {
    render(<LoginProviderButtons />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Войти через ВКонтакте' }),
    );
    expect(sessionStorage.getItem('auth_return_to')).toBe('/app/');
    expect(window.location.href).toBe('/api/auth/vk');
  });
});
