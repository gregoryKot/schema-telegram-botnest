// @vitest-environment jsdom
// Приход из установленного приложения на компьютере: метку ?from=app считаем
// один раз (событие для /stats) и убираем из адреса — техническому параметру
// нечего делать в адресной строке и в истории браузера.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

import { api } from '../api';
import { useDesktopAppLaunch } from './useDesktopAppLaunch';

beforeEach(() => {
  vi.mocked(api.trackEvent).mockClear();
  window.history.replaceState({}, '', '/today');
});

describe('useDesktopAppLaunch', () => {
  it('?from=app: шлёт событие и вычищает параметр', () => {
    window.history.replaceState({}, '', '/today?from=app');
    renderHook(() => useDesktopAppLaunch());
    expect(api.trackEvent).toHaveBeenCalledWith('desktop_app_open');
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/today');
  });

  it('обычный заход без метки — молчим', () => {
    renderHook(() => useDesktopAppLaunch());
    expect(api.trackEvent).not.toHaveBeenCalled();
  });

  it('чужое значение параметра не считается запуском приложения', () => {
    window.history.replaceState({}, '', '/today?from=email');
    renderHook(() => useDesktopAppLaunch());
    expect(api.trackEvent).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?from=email');
  });

  it('остальные параметры адреса переживают чистку', () => {
    window.history.replaceState({}, '', '/today?from=app&section=diary');
    renderHook(() => useDesktopAppLaunch());
    expect(window.location.search).toBe('?section=diary');
  });
});
