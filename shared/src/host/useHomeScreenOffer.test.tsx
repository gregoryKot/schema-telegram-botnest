// @vitest-environment jsdom
// Общее ядро хука «установить приложение» (обёртки сайта и мини-аппа подставляют
// свой trackEvent). Хост — настоящий детектор по globalThis.Telegram.WebApp: подмена
// через setHost затирается, если детектор говорит другое, поэтому тест на шве.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setHost } from './index';
import { getOfferMemory } from './homeScreen';
import { useHomeScreenOfferState } from './useHomeScreenOffer';

function installTelegram(platform = 'android') {
  (globalThis as { Telegram?: unknown }).Telegram = {
    WebApp: { platform, initData: 'query_id=1' },
  };
  setHost(null);
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

  it('десктопный Telegram не показывается', () => {
    installTelegram('tdesktop');
    const track = vi.fn();
    const { result } = renderHook(() =>
      useHomeScreenOfferState('today', track),
    );
    expect(result.current.visible).toBe(false);
  });

  it('Android в Telegram, память пуста → показывается сразу, событие shown один раз', () => {
    installTelegram();
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
    installTelegram();
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
    installTelegram();
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

  it('нажатие «Установить» — событие add и снуз', () => {
    installTelegram();
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
});
