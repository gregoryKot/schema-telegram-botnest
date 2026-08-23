// @vitest-environment jsdom
// useUserFlags — модульный синглтон флагов (тема, онбординг, и т.п.),
// общий на всё приложение. Модульное состояние (flags/loaded/fetchPromise)
// не экспортировано для сброса — поэтому каждый тест делает vi.resetModules()
// и динамический re-import, иначе тесты видели бы состояние друг друга.
// Проверяет: read-after-write (setFlag оптимистично обновляет локально ДО
// ответа сервера) и что сетевая ошибка не роняет приложение и не блокирует
// стартовое состояние (loaded остаётся управляемым, дефолты — фолбэк).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
  // Хост — Telegram: у веб-хоста authedFetch сначала меняет refresh-куку на
  // токен (hasInstantAuth), и одиночный мок fetch съедался бы обменом. Эти
  // тесты — про флаги, не про авторизацию.
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: { initData: 'query_id=AAA&hash=deadbeef' },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

async function freshModule() {
  return import('./useUserFlags');
}

describe('useUserFlags — загрузка с сервера', () => {
  it('успешный ответ сервера подменяет дефолты серверными значениями', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ therapistMode: true, defaultSection: 'today' }),
    });
    const { useUserFlags } = await freshModule();
    const { result } = renderHook(() => useUserFlags());
    expect(result.current.loaded).toBe(false); // до ответа — не выдаём дефолт за загруженное
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.loaded).toBe(true);
    expect(result.current.flags.therapistMode).toBe(true);
    expect(result.current.flags.defaultSection).toBe('today');
  });

  it('сетевая ошибка — остаёмся на дефолтах, но loaded всё равно true (не вечная загрузка)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    const { useUserFlags } = await freshModule();
    const { result } = renderHook(() => useUserFlags());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.loaded).toBe(true);
    expect(result.current.flags.therapistMode).toBe(false);
  });
});

describe('useUserFlags — setFlag (оптимистичная запись)', () => {
  it('обновляет флаг локально сразу, не дожидаясь ответа POST', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const { useUserFlags } = await freshModule();
    const { result } = renderHook(() => useUserFlags());
    await act(async () => {
      await Promise.resolve();
    });
    let setPromise!: Promise<void>;
    act(() => {
      setPromise = result.current.setFlag('childhoodWheelDone', true);
    });
    // Локальное состояние обновилось СИНХРОННО, до резолва fetch.
    expect(result.current.flags.childhoodWheelDone).toBe(true);
    await act(async () => {
      await setPromise;
    });
  });

  it('POST падает — локальное значение всё равно остаётся (не откатывается молча)', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockRejectedValueOnce(new Error('network'));
    const { useUserFlags } = await freshModule();
    const { result } = renderHook(() => useUserFlags());
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.setFlag('ysqBannerDismissed', true);
    });
    expect(result.current.flags.ysqBannerDismissed).toBe(true);
  });
});

describe('useUserFlags — updateFlags (пакетное обновление)', () => {
  it('несколько флагов обновляются вместе, остальные не трогаются', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const { useUserFlags } = await freshModule();
    const { result } = renderHook(() => useUserFlags());
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await result.current.updateFlags({
        onboardingV1Done: true,
        onboardingV2Done: true,
      });
    });
    expect(result.current.flags.onboardingV1Done).toBe(true);
    expect(result.current.flags.onboardingV2Done).toBe(true);
    expect(result.current.flags.therapistMode).toBe(false); // не задет
  });
});

// Регресс «двадцать раз прошёл онбординг» (2026-08-21). Дефолтные флаги
// неотличимы от флагов новичка, поэтому решение «показать первый вход»
// опирается на loadedFromServer, а не на loaded.
describe('useUserFlags — loadedFromServer', () => {
  it('успешный ответ: флаги прочитаны с сервера', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ onboardingV2Done: true }),
    });
    const { useUserFlags } = await freshModule();
    const { result } = renderHook(() => useUserFlags());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.loadedFromServer).toBe(true);
    expect(result.current.flags.onboardingV2Done).toBe(true);
  });

  it('сетевая ошибка: попытка завершена, но серверных флагов у нас нет', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    const { useUserFlags } = await freshModule();
    const { result } = renderHook(() => useUserFlags());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.loaded).toBe(true);
    expect(result.current.loadedFromServer).toBe(false);
  });

  it('401 без возможности перевыпустить сессию: серверных флагов нет', async () => {
    // Именно этот случай и ломал вход из браузера: запрос уходил без Bearer,
    // сервер отвечал 401, а дефолты выдавались за «пользователь новый».
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    const { useUserFlags } = await freshModule();
    const { result } = renderHook(() => useUserFlags());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.loadedFromServer).toBe(false);
    expect(result.current.flags.onboardingV2Done).toBe(false);
  });
});
