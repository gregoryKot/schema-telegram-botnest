// @vitest-environment jsdom
// Черновик упражнения (QA 2026-11, З3): ввёл → перезагрузил (новый монтаж
// хука, как после F5 или «Назад») → текст на месте; после сохранения
// черновика нет. Сохранил → нашёл, а не только «записалось».
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import {
  hasDraftText,
  restoreDraft,
  useDraftAutosave,
} from './useDraftAutosave';
import { loadDraftAt } from './drafts';

const KEY = 'exercise_draft_test';

interface Form {
  text: string;
  items: string[];
  step: number;
}

// Как форма упражнения: начальное состояние из черновика + автосохранение.
function useForm() {
  const [d] = useState(() => restoreDraft<Form>(KEY));
  const [text, setText] = useState(d?.text ?? '');
  const [items, setItems] = useState<string[]>(d?.items ?? []);
  const [step, setStep] = useState(d?.step ?? 0);
  const clear = useDraftAutosave(KEY, { text, items, step });
  return { text, setText, items, setItems, step, setStep, clear };
}

beforeEach(() => localStorage.clear());

describe('useDraftAutosave — ввёл → перезагрузил → на месте', () => {
  it('текст, список и шаг переживают перемонтирование', () => {
    const first = renderHook(() => useForm());
    act(() => {
      first.result.current.setText('Дорогой маленький я');
      first.result.current.setItems(['опоздал на встречу']);
      first.result.current.setStep(2);
    });
    first.unmount();

    const again = renderHook(() => useForm());
    expect(again.result.current.text).toBe('Дорогой маленький я');
    expect(again.result.current.items).toEqual(['опоздал на встречу']);
    expect(again.result.current.step).toBe(2);
  });

  it('после clear (успешное сохранение) форма открывается пустой', () => {
    const first = renderHook(() => useForm());
    act(() => first.result.current.setText('Письмо'));
    act(() => first.result.current.clear());
    first.unmount();
    expect(loadDraftAt(KEY)).toBeNull();
    expect(renderHook(() => useForm()).result.current.text).toBe('');
  });

  it('после clear тот же снимок не пишется заново, правка — пишется', () => {
    const h = renderHook(() => useForm());
    act(() => h.result.current.setText('Письмо'));
    act(() => h.result.current.clear());
    h.rerender();
    expect(loadDraftAt(KEY)).toBeNull();
    act(() => h.result.current.setText('Письмо, исправленное'));
    expect(loadDraftAt<Form>(KEY)?.data.text).toBe('Письмо, исправленное');
  });

  it('стёр весь текст — черновика нет, хотя шаг не нулевой', () => {
    const h = renderHook(() => useForm());
    act(() => {
      h.result.current.setText('x');
      h.result.current.setStep(1);
    });
    expect(loadDraftAt(KEY)).not.toBeNull();
    act(() => h.result.current.setText('   '));
    expect(loadDraftAt(KEY)).toBeNull();
  });

  it('битый черновик — пустая форма, не падение', () => {
    localStorage.setItem(KEY, '{не json');
    expect(renderHook(() => useForm()).result.current.text).toBe('');
    localStorage.setItem(KEY, JSON.stringify({ startedAt: 'x', data: ['a'] }));
    expect(restoreDraft(KEY)).toBeNull();
  });
});

describe('hasDraftText', () => {
  it('текст в любой глубине — да; пробелы, числа и флаги — нет', () => {
    expect(hasDraftText({ a: '', b: { c: ['', 'слово'] } })).toBe(true);
    expect(hasDraftText({ a: ' ', step: 3, flag: true, list: [] })).toBe(false);
  });
});
