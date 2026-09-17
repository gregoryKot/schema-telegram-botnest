// @vitest-environment jsdom
// Состояние блока «Фраза для себя»: загрузка на монтировании, reload()
// (кнопка «Другая ↻») честно возвращает скелетон, draw() не рисует без
// фразы, showShare переключается независимо от загрузки.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePhraseShareCard } from './usePhraseShareCard';

// jsdom не реализует canvas 2D-контекст — рисование здесь не тестируем
// (оно покрыто cards/phraseCard.test.ts), проверяем только что draw()
// вызывается/не вызывается в зависимости от наличия фразы.
const drawPhraseCard = vi.fn();
vi.mock('./cards/phraseCard', () => ({
  drawPhraseCard: (...args: unknown[]) => drawPhraseCard(...args),
}));

describe('usePhraseShareCard', () => {
  it('стартует с loading=true, phrase=null, после загрузки подставляет фразу', async () => {
    const get = vi.fn().mockResolvedValue({ text: 'ты в порядке' });
    const { result } = renderHook(() => usePhraseShareCard(get));
    expect(result.current.loading).toBe(true);
    expect(result.current.phrase).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.phrase).toBe('ты в порядке');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('ошибка загрузки — phrase остаётся null, loading снимается', async () => {
    const get = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => usePhraseShareCard(get));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.phrase).toBeNull();
  });

  it('reload() выставляет loading=true и запрашивает фразу заново', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ text: 'первая' })
      .mockResolvedValueOnce({ text: 'вторая' });
    const { result } = renderHook(() => usePhraseShareCard(get));
    await waitFor(() => expect(result.current.phrase).toBe('первая'));

    act(() => result.current.reload());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.phrase).toBe('вторая'));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('draw() не вызывает drawPhraseCard без фразы, вызывает — когда фраза загружена', async () => {
    drawPhraseCard.mockClear();
    const get = vi.fn().mockResolvedValue({ text: 'фраза' });
    const { result } = renderHook(() => usePhraseShareCard(get));
    const canvas = document.createElement('canvas');
    result.current.draw(canvas);
    expect(drawPhraseCard).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.phrase).toBe('фраза'));
    result.current.draw(canvas);
    expect(drawPhraseCard).toHaveBeenCalledWith(canvas, 'фраза');
  });

  it('setShowShare переключает showShare', async () => {
    const get = vi.fn().mockResolvedValue({ text: 'фраза' });
    const { result } = renderHook(() => usePhraseShareCard(get));
    expect(result.current.showShare).toBe(false);
    act(() => result.current.setShowShare(true));
    expect(result.current.showShare).toBe(true);
  });
});
