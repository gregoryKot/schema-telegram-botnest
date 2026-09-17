// @vitest-environment jsdom
// useSavingAction — общий примитив «сохраняю → готово/ошибка», вынесенный из
// FlashcardEx/SafePlaceEx/ChildhoodWheelEx (аудит 2026-08-22, находка №2:
// кнопка сохранения не показывала состояние отправки, не защищала от
// двойного нажатия, а сбой api-вызова падал молча).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSavingAction } from './useSavingAction';

describe('useSavingAction', () => {
  it('saving=true пока промис не разрешился, затем возвращается к false', async () => {
    const { result } = renderHook(() => useSavingAction());
    let resolveFn: () => void = () => {};
    const pending = new Promise<void>((res) => { resolveFn = res; });

    expect(result.current.saving).toBe(false);
    let runPromise!: Promise<boolean>;
    act(() => { runPromise = result.current.run(() => pending); });
    await waitFor(() => expect(result.current.saving).toBe(true));

    await act(async () => { resolveFn(); await runPromise; });
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBe(false);
    expect(await runPromise).toBe(true);
  });

  it('сбой fn выставляет error=true и возвращает false (не молчит)', async () => {
    const { result } = renderHook(() => useSavingAction());
    let ok = true;
    await act(async () => {
      ok = await result.current.run(() => Promise.reject(new Error('offline')));
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBe(true);
    expect(result.current.saving).toBe(false);
  });

  it('повторный run во время выполнения игнорируется — защита от двойного нажатия', async () => {
    const { result } = renderHook(() => useSavingAction());
    const fn = vi.fn(() => new Promise<void>(() => {})); // никогда не резолвится
    act(() => { result.current.run(fn); });
    await waitFor(() => expect(result.current.saving).toBe(true));

    let second!: boolean;
    await act(async () => { second = await result.current.run(fn); });
    expect(second).toBe(false); // не запущен повторно
    expect(fn).toHaveBeenCalledTimes(1); // fn вызван ровно один раз, а не дважды
  });

  it('reset() сбрасывает error, не трогая saving', () => {
    const { result } = renderHook(() => useSavingAction());
    act(() => { result.current.reset(); });
    expect(result.current.error).toBe(false);
  });
});
