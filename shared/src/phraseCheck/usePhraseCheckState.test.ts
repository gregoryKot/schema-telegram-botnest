// @vitest-environment jsdom
// Общее состояние мастера «Критик или забота?» (webapp ↔ miniapp, правило №3).
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhraseCheckState } from './usePhraseCheckState';

describe('usePhraseCheckState', () => {
  it('стартует с -1 (ввод фразы), без примет, inWarmWords=true по умолчанию', () => {
    const { result } = renderHook(() => usePhraseCheckState());
    expect(result.current.markIndex).toBe(-1);
    expect(result.current.marks).toEqual([]);
    expect(result.current.inWarmWords).toBe(true);
  });

  it('answer(id, critic=true) добавляет примету и двигает markIndex вперёд', () => {
    const { result } = renderHook(() => usePhraseCheckState());
    act(() => result.current.answer('worth', true));
    expect(result.current.marks).toEqual(['worth']);
    expect(result.current.markIndex).toBe(0);
  });

  it('answer(id, critic=false) НЕ добавляет примету, но двигает markIndex', () => {
    const { result } = renderHook(() => usePhraseCheckState());
    act(() => result.current.answer('worth', false));
    expect(result.current.marks).toEqual([]);
    expect(result.current.markIndex).toBe(0);
  });

  it('одна и та же примета не дублируется при повторном критик-ответе', () => {
    const { result } = renderHook(() => usePhraseCheckState());
    act(() => result.current.answer('worth', true));
    act(() => result.current.setMarkIndex(0));
    act(() => result.current.answer('worth', true));
    expect(result.current.marks).toEqual(['worth']);
  });

  it('reset() возвращает всё состояние к начальным значениям (webapp «Проверить ещё одну»)', () => {
    const { result } = renderHook(() => usePhraseCheckState());
    act(() => result.current.setPhrase('фраза'));
    act(() => result.current.answer('worth', true));
    act(() => result.current.setRewrite('переписано'));
    act(() => result.current.setInWarmWords(false));

    act(() => result.current.reset());

    expect(result.current.phrase).toBe('');
    expect(result.current.markIndex).toBe(-1);
    expect(result.current.marks).toEqual([]);
    expect(result.current.rewrite).toBe('');
    expect(result.current.inWarmWords).toBe(true);
  });
});
