// @vitest-environment jsdom
// Черновик «Колеса детства»: середина ползунка — не ответ (BACKLOG, 5/5/5/5/5
// сохранялись, если ничего не трогать). Оба фронтенда берут этот хук.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  previewRatings,
  unratedHint,
  unratedNeeds,
  useChildhoodDraft,
} from './useChildhoodDraft';

const SAVED = { attachment: 2, autonomy: 8, expression: 6, play: 9, limits: 7 };

describe('useChildhoodDraft', () => {
  it('новый человек: все пять не оценены, выставленная руками уходит из списка', () => {
    const { result } = renderHook(() => useChildhoodDraft());
    expect(result.current.unrated).toEqual([
      'attachment',
      'autonomy',
      'expression',
      'play',
      'limits',
    ]);
    act(() => result.current.rate('play', 5));
    expect(result.current.unrated).toEqual([
      'attachment',
      'autonomy',
      'expression',
      'limits',
    ]);
    expect(result.current.ratings.play).toBe(5);
    act(() => result.current.rate('play', 3));
    expect(result.current.rated).toEqual(['play']);
  });

  it('сохранённое колесо оценено целиком — правка работает как раньше', () => {
    const { result } = renderHook(() => useChildhoodDraft(SAVED, true));
    expect(result.current.unrated).toEqual([]);
    expect(result.current.ratings).toEqual(SAVED);
  });

  it('load: пришедшее с сервера — оценено, пустой ответ — снова не оценено', () => {
    const { result } = renderHook(() => useChildhoodDraft());
    act(() => result.current.load(SAVED, true));
    expect(result.current.unrated).toEqual([]);
    act(() => result.current.load(SAVED, false));
    expect(result.current.unrated.length).toBe(5);
  });
});

describe('помощники черновика', () => {
  it('unratedNeeds держит порядок экрана', () => {
    expect(unratedNeeds(['limits', 'attachment'])).toEqual([
      'autonomy',
      'expression',
      'play',
    ]);
  });

  it('previewRatings: неоценённая — пустой сектор, оценённая — как есть', () => {
    expect(previewRatings(SAVED, ['play'])).toEqual({ ...SAVED, play: 0 });
    expect(previewRatings(SAVED, [])).toEqual(SAVED);
  });

  it('unratedHint считает остаток из пяти', () => {
    expect(unratedHint(3)).toBe('Ещё не оценено: 3 из 5');
  });
});
