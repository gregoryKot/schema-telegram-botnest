// @vitest-environment jsdom
// Состояние карточки прошлого разбора (webapp ↔ miniapp, правило №3).
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePhraseHistoryCard,
  type PhraseHistoryEntry,
} from './usePhraseHistoryCard';

const ENTRY: PhraseHistoryEntry = {
  id: 1,
  phrase: 'я всё порчу',
  marks: ['goal', 'label'],
  rewrite: 'старая правка',
};

describe('usePhraseHistoryCard', () => {
  it('стартует с rewrite из entry, вычисляет подписи примет', () => {
    const { result } = renderHook(() =>
      usePhraseHistoryCard(ENTRY, vi.fn(), vi.fn()),
    );
    expect(result.current.rewrite).toBe('старая правка');
    expect(result.current.markLabels.length).toBe(2);
  });

  it('entry.rewrite=null — стартует с пустой строки', () => {
    const { result } = renderHook(() =>
      usePhraseHistoryCard({ ...ENTRY, rewrite: null }, vi.fn(), vi.fn()),
    );
    expect(result.current.rewrite).toBe('');
  });

  it('setRewrite меняет текст и сбрасывает error', async () => {
    const update = vi.fn().mockRejectedValue(new Error('x'));
    const { result } = renderHook(() =>
      usePhraseHistoryCard(ENTRY, update, vi.fn()),
    );
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.error).toBe(true);
    act(() => result.current.setRewrite('новый текст'));
    expect(result.current.rewrite).toBe('новый текст');
    expect(result.current.error).toBe(false);
  });

  it('save() успешно — вызывает onUpdated с обрезанным текстом от сервера, возвращает true', async () => {
    const update = vi.fn().mockResolvedValue({ rewrite: 'сохранённый ответ' });
    const onUpdated = vi.fn();
    const { result } = renderHook(() =>
      usePhraseHistoryCard(ENTRY, update, onUpdated),
    );
    act(() => result.current.setRewrite('  новый ответ  '));
    let ok = false;
    await act(async () => {
      ok = await result.current.save();
    });
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalledWith(1, 'новый ответ');
    expect(onUpdated).toHaveBeenCalledWith(1, 'сохранённый ответ');
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('save() падает — error=true, onUpdated не зовётся, возвращает false', async () => {
    const update = vi.fn().mockRejectedValue(new Error('network'));
    const onUpdated = vi.fn();
    const { result } = renderHook(() =>
      usePhraseHistoryCard(ENTRY, update, onUpdated),
    );
    let ok = true;
    await act(async () => {
      ok = await result.current.save();
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBe(true);
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('неизвестный id приметы не даёт подписи — фильтруется', () => {
    const { result } = renderHook(() =>
      usePhraseHistoryCard(
        // @ts-expect-error — намеренно левый id, проверяем фильтр
        { ...ENTRY, marks: ['goal', 'unknown'] },
        vi.fn(),
        vi.fn(),
      ),
    );
    expect(result.current.markLabels.length).toBe(1);
  });
});
