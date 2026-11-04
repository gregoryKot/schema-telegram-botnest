// @vitest-environment jsdom
// Общее состояние мастера «Критик или забота?» (webapp ↔ miniapp, правило №3).
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhraseCheckState } from './usePhraseCheckState';
import { EXERCISE_DRAFT_KEYS, loadDraftAt } from '../utils/drafts';

beforeEach(() => localStorage.clear());

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

// QA 2026-11, З3: фраза, приметы и переписанное переживают F5 и «Назад»
// (новый монтаж хука) на обеих площадках — хук общий.
describe('usePhraseCheckState — черновик', () => {
  it('ввёл фразу и прошёл две приметы → перемонтировал → всё на месте', () => {
    const first = renderHook(() => usePhraseCheckState());
    act(() => first.result.current.setPhrase('опять всё завалила'));
    act(() => first.result.current.setMarkIndex(0));
    act(() => first.result.current.answer('worth', true));
    act(() => first.result.current.answer('goal', false));
    first.unmount();

    const { result } = renderHook(() => usePhraseCheckState());
    expect(result.current.phrase).toBe('опять всё завалила');
    expect(result.current.markIndex).toBe(2);
    expect(result.current.marks).toEqual(['worth']);
  });

  it('clearDraft после сохранения — следующее открытие с пустой фразы', () => {
    const first = renderHook(() => usePhraseCheckState());
    act(() => first.result.current.setPhrase('фраза'));
    act(() => first.result.current.clearDraft());
    first.unmount();
    expect(loadDraftAt(EXERCISE_DRAFT_KEYS.phraseCheck)).toBeNull();
    expect(renderHook(() => usePhraseCheckState()).result.current.phrase).toBe(
      '',
    );
  });

  it('шаг без фразы и чужие приметы из старого черновика не восстанавливаются', () => {
    localStorage.setItem(
      EXERCISE_DRAFT_KEYS.phraseCheck,
      JSON.stringify({
        startedAt: '',
        data: { phrase: '', markIndex: 5, marks: ['worth', 'нет такой'] },
      }),
    );
    const { result } = renderHook(() => usePhraseCheckState());
    expect(result.current.markIndex).toBe(-1);
    expect(result.current.marks).toEqual(['worth']);
  });
});
