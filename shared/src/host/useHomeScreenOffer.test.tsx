// @vitest-environment jsdom
// Общее ядро хука «значок на экран» (обёртки сайта и мини-аппа подставляют свой
// trackEvent). Хост — настоящий детектор по globalThis.Telegram.WebApp: подмена
// через setHost затирается, если детектор говорит другое, поэтому тест на шве.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setHost } from './index';
import { getOfferMemory } from './homeScreen';
import { useHomeScreenOfferState } from './useHomeScreenOffer';

type Stub = Record<string, unknown>;
type Listener = () => void;

function installTelegram(status: 'missed' | 'added' | 'unknown' = 'missed') {
  const listeners = new Set<Listener>();
  const webApp: Stub = {
    platform: 'android',
    initData: 'query_id=1',
    addToHomeScreen: vi.fn(),
    checkHomeScreenStatus: (cb: (s: string) => void) => cb(status),
    onEvent: (name: string, cb: Listener) => {
      if (name === 'homeScreenAdded') listeners.add(cb);
    },
    offEvent: (name: string, cb: Listener) => {
      if (name === 'homeScreenAdded') listeners.delete(cb);
    },
  };
  (globalThis as { Telegram?: unknown }).Telegram = { WebApp: webApp };
  setHost(null);
  return { webApp, fireAdded: () => listeners.forEach((l) => l()) };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  delete (globalThis as { Telegram?: unknown }).Telegram;
  setHost(null);
});

describe('useHomeScreenOfferState', () => {
  it('в браузере не показывается и ничего не шлёт', () => {
    const track = vi.fn();
    const { result } = renderHook(() =>
      useHomeScreenOfferState('today', track),
    );
    expect(result.current.visible).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('Android, значка нет, память пуста → показывается, событие shown один раз', () => {
    installTelegram('missed');
    const track = vi.fn();
    const { result, rerender } = renderHook(() =>
      useHomeScreenOfferState('today', track),
    );
    expect(result.current.visible).toBe(true);
    expect(result.current.platform).toBe('android');
    rerender();
    expect(
      track.mock.calls.filter(
        ([n, m]) => n === 'home_screen_offer' && m.action === 'shown',
      ),
    ).toHaveLength(1);
    expect(track).toHaveBeenCalledWith('home_screen_offer', {
      action: 'shown',
      surface: 'today',
    });
  });

  it('«Позже» — снуз в памяти, событие later, карточка скрыта', () => {
    installTelegram('missed');
    const track = vi.fn();
    const { result } = renderHook(() =>
      useHomeScreenOfferState('today', track),
    );
    act(() => result.current.later());
    expect(result.current.visible).toBe(false);
    expect(getOfferMemory().kind).toBe('snoozed');
    expect(track).toHaveBeenCalledWith('home_screen_offer', {
      action: 'later',
      surface: 'today',
    });
  });

  it('«Не предлагать» — память never, событие never', () => {
    installTelegram('missed');
    const track = vi.fn();
    const { result } = renderHook(() =>
      useHomeScreenOfferState('settings', track),
    );
    act(() => result.current.never());
    expect(getOfferMemory()).toEqual({ kind: 'never' });
    expect(track).toHaveBeenCalledWith('home_screen_offer', {
      action: 'never',
      surface: 'settings',
    });
  });

  it('нажатие «Добавить» — событие add и снуз до ответа Telegram', () => {
    installTelegram('missed');
    const track = vi.fn();
    const { result } = renderHook(() =>
      useHomeScreenOfferState('today', track),
    );
    act(() => result.current.noteAddTriggered());
    expect(track).toHaveBeenCalledWith('home_screen_offer', {
      action: 'add',
      surface: 'today',
    });
    expect(getOfferMemory().kind).toBe('snoozed');
    expect(result.current.visible).toBe(false);
  });

  it('Telegram сообщил homeScreenAdded — память added, событие added, карточка скрыта', () => {
    const tg = installTelegram('missed');
    const track = vi.fn();
    const { result } = renderHook(() =>
      useHomeScreenOfferState('today', track),
    );
    act(() => tg.fireAdded());
    expect(getOfferMemory()).toEqual({ kind: 'added' });
    expect(track).toHaveBeenCalledWith('home_screen_offer', {
      action: 'added',
      surface: 'today',
    });
    expect(result.current.visible).toBe(false);
  });

  it('значок уже стоит по данным Telegram — не показывается', () => {
    installTelegram('added');
    const track = vi.fn();
    const { result } = renderHook(() =>
      useHomeScreenOfferState('today', track),
    );
    expect(result.current.visible).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });
});
