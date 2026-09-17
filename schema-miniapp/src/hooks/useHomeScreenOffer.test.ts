// @vitest-environment jsdom
// Хук предложения «добавить значок на экран» — общая память (снуз/отказ)
// для всех мест показа (правило «одна механика — один компонент»). Хост
// мокается теми же глобалами, что shared/src/host/host.test.ts (getHost()
// определяет хост живым чтением window.Telegram, setHost() не переживёт
// повторный вызов detectHostId()).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setHost } from '../../../shared/src/host';
import { useHomeScreenOffer } from './useHomeScreenOffer';

vi.mock('../api', () => ({
  api: { trackEvent: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function setTelegramHost(status: 'missed' | 'added' | 'unknown') {
  (globalThis as { Telegram?: unknown }).Telegram = {
    WebApp: {
      platform: 'android',
      initData: 'hash=abc',
      addToHomeScreen: vi.fn(),
      checkHomeScreenStatus: (cb: (s: string) => void) => cb(status),
      onEvent: vi.fn(),
      offEvent: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setHost(null);
  delete (globalThis as { Telegram?: unknown }).Telegram;
  localStorage.clear();
});

describe('useHomeScreenOffer — видимость предложения', () => {
  it('в Telegram на Android, значка нет — предложение видно', () => {
    setTelegramHost('missed');
    const { result } = renderHook(() => useHomeScreenOffer('today'));
    act(() => {});
    expect(result.current.visible).toBe(true);
    expect(result.current.platform).toBe('android');
  });

  it('Telegram говорит "added" — предложение скрыто, даже если память "fresh"', () => {
    setTelegramHost('added');
    const { result } = renderHook(() => useHomeScreenOffer('today'));
    act(() => {});
    expect(result.current.visible).toBe(false);
  });

  it('в браузере (хост без capabilities.homeScreen) — предложение никогда не видно', () => {
    const { result } = renderHook(() => useHomeScreenOffer('today'));
    act(() => {});
    expect(result.current.visible).toBe(false);
  });
});

describe('useHomeScreenOffer — побочные действия', () => {
  it('noteAddTriggered трекает "add", снузит и скрывает карточку', () => {
    setTelegramHost('missed');
    const { result } = renderHook(() => useHomeScreenOffer('settings'));
    act(() => {});
    expect(result.current.visible).toBe(true);
    act(() => result.current.noteAddTriggered());
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_screen_offer', {
      action: 'add',
      surface: 'settings',
    });
    expect(result.current.visible).toBe(false);
    // Снуз реально записан — следующий инстанс хука тоже не покажет карточку.
    expect(localStorage.getItem('home_screen_offer')).not.toBeNull();
  });

  it('later снузит на неделю и скрывает карточку сразу', () => {
    setTelegramHost('missed');
    const { result } = renderHook(() => useHomeScreenOffer('today'));
    act(() => {});
    act(() => result.current.later());
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_screen_offer', {
      action: 'later',
      surface: 'today',
    });
    expect(result.current.visible).toBe(false);
  });

  it('never помечает «не предлагать» навсегда', () => {
    setTelegramHost('missed');
    const { result } = renderHook(() => useHomeScreenOffer('onboarding'));
    act(() => {});
    act(() => result.current.never());
    expect(mockApi.trackEvent).toHaveBeenCalledWith('home_screen_offer', {
      action: 'never',
      surface: 'onboarding',
    });
    expect(localStorage.getItem('home_screen_offer')).toBe('never');
    expect(result.current.visible).toBe(false);
  });
});
