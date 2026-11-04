// @vitest-environment jsdom
// Форма «Проверки убеждения» (общая для сайта и мини-аппа) живёт в черновике:
// ввёл → перемонтировал (F5, «Назад») → всё на месте (QA 2026-11, З3).
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBeliefCheckForm } from './useBeliefCheckForm';
import { EXERCISE_DRAFT_KEYS, loadDraftAt } from '../utils/drafts';

const KEY = EXERCISE_DRAFT_KEYS.beliefCheck;

beforeEach(() => localStorage.clear());

describe('useBeliefCheckForm — черновик', () => {
  it('убеждение, доказательства, недописанный ввод и шаг переживают перемонтирование', () => {
    const first = renderHook(() => useBeliefCheckForm());
    act(() => first.result.current.setBelief('Я всегда всё порчу'));
    act(() => first.result.current.setForInput('Забыл про встречу'));
    act(() => first.result.current.addFor());
    act(() => first.result.current.setAgainstInput('Вчера всё получилось'));
    act(() => first.result.current.setStep(2));
    first.unmount();

    const { result } = renderHook(() => useBeliefCheckForm());
    expect(result.current.belief).toBe('Я всегда всё порчу');
    expect(result.current.forList).toEqual(['Забыл про встречу']);
    expect(result.current.forInput).toBe('');
    expect(result.current.againstInput).toBe('Вчера всё получилось');
    expect(result.current.step).toBe(2);
  });

  it('clearDraft после сохранения и reset — следующее открытие с нуля', () => {
    const first = renderHook(() => useBeliefCheckForm());
    act(() => first.result.current.setBelief('мысль'));
    act(() => first.result.current.clearDraft());
    expect(loadDraftAt(KEY)).toBeNull();
    act(() => first.result.current.setReframe('точнее'));
    act(() => first.result.current.reset());
    first.unmount();
    expect(loadDraftAt(KEY)).toBeNull();
    const { result } = renderHook(() => useBeliefCheckForm());
    expect(result.current.belief).toBe('');
    expect(result.current.step).toBe(0);
  });

  it('битый шаг и не-строки в списках из старого черновика отбрасываются', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        startedAt: '',
        data: { belief: 'мысль', step: 7, forList: ['да', 3, null] },
      }),
    );
    const { result } = renderHook(() => useBeliefCheckForm());
    expect(result.current.step).toBe(0);
    expect(result.current.forList).toEqual(['да']);
    expect(result.current.againstList).toEqual([]);
  });
});
