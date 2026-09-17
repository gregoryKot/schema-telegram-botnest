// @vitest-environment jsdom
// Регрессия (три скриншота подряд, 2026-08): шапка стояла под кнопками
// Telegram, хотя computeSafeTop считал верно и фикс лежал в проде.
//
// Причина была не в формуле, а в подписке. telegram-web-app.js грузится
// асинхронно: до его прихода WebApp пустой, и приложение честно определяет
// себя как открытое в браузере. У браузерного адаптера onInsetsChange —
// заглушка, которая никогда не позовёт колбэк. Значит первая же такая гонка
// замораживала отступ нулём навсегда: хост уже стал телеграмным, а перечитать
// было некому. Механизм поздних чтений жил ВНУТРИ телеграмного адаптера — в
// той самой ветке, которая не запускалась.
//
// Тест воспроизводит именно гонку: объект Telegram появляется ПОСЛЕ первого
// рендера, как в реальном клиенте.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { setHost } from '../../../shared/src/host';
import { useSafeTop } from './safezone';

function Probe() {
  return <div data-testid="top">{useSafeTop()}</div>;
}

function top(): number {
  return Number(screen.getByTestId('top').textContent);
}

/** Скрипт мессенджера доехал: WebApp появился и назвал платформу. */
function telegramArrives(): void {
  (globalThis as unknown as { Telegram: unknown }).Telegram = {
    WebApp: {
      platform: 'ios',
      initData: 'query_id=1',
      onEvent: () => {},
      offEvent: () => {},
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  setHost(null);
  delete (globalThis as unknown as { Telegram?: unknown }).Telegram;
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  setHost(null);
  delete (globalThis as unknown as { Telegram?: unknown }).Telegram;
  cleanup();
});

describe('useSafeTop — хост определился позже монтирования', () => {
  it('браузер на старте, Telegram через мгновение → отступ пересчитан', () => {
    render(<Probe />);
    expect(top()).toBe(0);

    telegramArrives();
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Ниже нижнего края пилюли «Закрыть» (~87pt), а не просто «не ноль».
    expect(top()).toBeGreaterThan(87);
  });

  it('в браузере лишнего отступа не появляется даже после всех перечитываний', () => {
    render(<Probe />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(top()).toBe(0);
  });

  it('возврат в приложение перечитывает инсеты', () => {
    render(<Probe />);
    expect(top()).toBe(0);

    telegramArrives();
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(top()).toBeGreaterThan(87);
  });
});
