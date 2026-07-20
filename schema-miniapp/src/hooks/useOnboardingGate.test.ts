// @vitest-environment jsdom
// Read-after-write на связку «прошёл шаг → шаг не показывается снова».
// Инцидент (iOS): согласие сохранялось только в финальной кнопке, а шаг
// «добавить на экран» уводил пользователя из аппки — при заходе с ярлыка
// онбординг и согласие начинались заново.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createLocalStorageMock } from '../utils/localStorageMock';

const acceptDisclaimer = vi.fn(() => Promise.resolve());
const getDisclaimer = vi.fn(() => Promise.resolve({ accepted: false }));
const setFlag = vi.fn(() => Promise.resolve());

vi.mock('../api', () => ({
  api: {
    acceptDisclaimer: () => acceptDisclaimer(),
    getDisclaimer: () => getDisclaimer(),
  },
}));
vi.mock('../useUserFlags', () => ({
  setFlag: (...args: unknown[]) => setFlag(...(args as [])),
}));

import { useOnboardingGate } from './useOnboardingGate';

beforeEach(() => {
  (globalThis as { localStorage: unknown }).localStorage =
    createLocalStorageMock();
  sessionStorage.setItem('addr_form_asked', '1'); // форма обращения уже выбрана
  acceptDisclaimer.mockClear();
  getDisclaimer.mockClear();
  setFlag.mockClear();
});

// serverDone=false, flagsLoaded=true — новичок с загруженными флагами
const fresh = () => renderHook(() => useOnboardingGate(false, true));

describe('useOnboardingGate', () => {
  it('новичку онбординг показывается', () => {
    expect(fresh().result.current.visible).toBe(true);
  });

  it('пока серверные флаги не загрузились — не показывается', () => {
    const { result } = renderHook(() => useOnboardingGate(false, false));
    expect(result.current.visible).toBe(false);
  });

  it('согласие на шаге согласий сохраняется сразу — и на сервер, и локально', () => {
    const { result } = fresh();
    act(() => result.current.persist());
    expect(acceptDisclaimer).toHaveBeenCalledTimes(1);
    expect(setFlag).toHaveBeenCalledWith('onboardingV2Done', true);
    expect(localStorage.getItem('disclaimer_v2_accepted')).toBe('1');
    expect(localStorage.getItem('app_onboarding_seen_v1')).toBe('1');
  });

  it('persist не закрывает онбординг — шаг «добавить на экран» ещё впереди', () => {
    const { result } = fresh();
    act(() => result.current.persist());
    expect(result.current.visible).toBe(true);
  });

  it('persist идемпотентен: согласие не отправляется дважды', () => {
    const { result } = fresh();
    act(() => result.current.persist());
    act(() => result.current.persist());
    expect(acceptDisclaimer).toHaveBeenCalledTimes(1);
  });

  // Ядро инцидента: пользователь ушёл на шаге «добавить на экран», финальную
  // кнопку не нажал — согласие всё равно сохранено, при перезаходе не спросят.
  it('ушёл после согласия, не дойдя до финала → при перезаходе онбординга нет', () => {
    const first = fresh();
    act(() => first.result.current.persist());
    first.unmount();

    const second = fresh(); // тот же localStorage = перезапуск аппки
    expect(second.result.current.visible).toBe(false);
  });

  it('финальная кнопка закрывает онбординг и он не возвращается', () => {
    const first = fresh();
    act(() => first.result.current.accept());
    expect(first.result.current.visible).toBe(false);
    first.unmount();
    expect(fresh().result.current.visible).toBe(false);
  });

  // Ярлык на домашнем экране (iOS) открывается в отдельном хранилище: localStorage
  // пуст, и показ обязан закрываться серверным флагом.
  it('чистый localStorage, но серверный флаг стоит → онбординга нет', () => {
    const { result } = renderHook(() => useOnboardingGate(true, true));
    expect(result.current.visible).toBe(false);
    expect(localStorage.getItem('app_onboarding_seen_v1')).toBe('1');
  });

  it('согласие, данное на сайте, подтягивается с сервера', async () => {
    getDisclaimer.mockResolvedValueOnce({ accepted: true });
    const { result } = fresh();
    await act(async () => {});
    expect(result.current.consentGiven).toBe(true);
    expect(localStorage.getItem('disclaimer_v2_accepted')).toBe('1');
  });
});
