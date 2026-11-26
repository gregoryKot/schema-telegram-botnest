// @vitest-environment jsdom
// Инцидент 2026-10-18: форма благодарности, открытая без `existingItems`,
// стартовала пустой и сохранением стирала запись, сделанную раньше в этот день.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGratitudeItems } from './useGratitudeItems';
import type { GratitudeDiaryEntry } from '../types';

const entry = (date: string, items: string[]): GratitudeDiaryEntry => ({
  id: 1,
  date,
  items,
  createdAt: `${date}T08:00:00.000Z`,
});

const putDraft = (items: string[]) =>
  localStorage.setItem(
    'diary_draft_gratitude',
    JSON.stringify({ startedAt: '2026-10-18T09:00:00.000Z', data: { items } }),
  );

describe('useGratitudeItems', () => {
  beforeEach(() => localStorage.clear());

  it('existingItems переданы — готов сразу, загрузку не запускает', () => {
    const load = vi.fn();
    const { result } = renderHook(() =>
      useGratitudeItems({ date: '2026-10-18', existingItems: ['а'], load }),
    );
    expect(result.current.status).toBe('ready');
    expect(result.current.items).toEqual(['а']);
    expect(result.current.base).toEqual(['а']);
    expect(load).not.toHaveBeenCalled();
  });

  it('без existingItems: loading, затем пункты сохранённого дня', async () => {
    const load = vi
      .fn()
      .mockResolvedValue([
        entry('2026-10-17', ['вчера']),
        entry('2026-10-18', ['утро']),
      ]);
    const { result } = renderHook(() =>
      useGratitudeItems({ date: '2026-10-18', load }),
    );
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual(['утро', '', '']);
    // base — сохранённый день без пустых полей формы: с ним сервер сливает запись.
    expect(result.current.base).toEqual(['утро']);
  });

  it('записи за день нет — три пустых поля или черновик', async () => {
    const load = vi.fn().mockResolvedValue([entry('2026-10-17', ['вчера'])]);
    putDraft(['чай']);
    const { result } = renderHook(() =>
      useGratitudeItems({ date: '2026-10-18', load }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual(['чай']);
    // Черновик сервер не видел — в base его нет, иначе он считался бы удалённым.
    expect(result.current.base).toEqual([]);
  });

  it('запись есть и черновик с новым пунктом — запись плюс черновик', async () => {
    const load = vi.fn().mockResolvedValue([entry('2026-10-18', ['утро'])]);
    putDraft(['вечер', '']);
    const { result } = renderHook(() =>
      useGratitudeItems({ date: '2026-10-18', load }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual(['утро', 'вечер', '']);
  });

  it('сбой загрузки — error, пункты не подменены; retry загружает заново', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([entry('2026-10-18', ['утро'])]);
    const { result } = renderHook(() =>
      useGratitudeItems({ date: '2026-10-18', load }),
    );
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.items).toEqual(['', '', '']);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual(['утро', '', '']);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('размонтирование до ответа не обновляет состояние', async () => {
    let resolve!: (v: GratitudeDiaryEntry[]) => void;
    const load = vi.fn(
      () => new Promise<GratitudeDiaryEntry[]>((r) => (resolve = r)),
    );
    const { unmount } = renderHook(() =>
      useGratitudeItems({ date: '2026-10-18', load }),
    );
    unmount();
    await act(async () => resolve([]));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('existingItems появились, пока шла загрузка, — форма берёт их и готова', async () => {
    const load = vi.fn(() => new Promise<GratitudeDiaryEntry[]>(() => {}));
    const { result, rerender } = renderHook(
      ({ existing }: { existing?: string[] }) =>
        useGratitudeItems({
          date: '2026-10-18',
          existingItems: existing,
          load,
        }),
      { initialProps: {} },
    );
    expect(result.current.status).toBe('loading');
    rerender({ existing: ['утро'] });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.items).toEqual(['утро']);
    expect(result.current.base).toEqual(['утро']);
  });

  it('уже готовую форму смена existingItems не перезаписывает', () => {
    const load = vi.fn();
    const { result, rerender } = renderHook(
      ({ existing }: { existing: string[] }) =>
        useGratitudeItems({
          date: '2026-10-18',
          existingItems: existing,
          load,
        }),
      { initialProps: { existing: ['а'] } },
    );
    act(() => result.current.setItems(['а', 'новое']));
    rerender({ existing: ['а', 'б'] });
    expect(result.current.items).toEqual(['а', 'новое']);
    // base — то, с чего форма начала, а не поздний снимок точки входа.
    expect(result.current.base).toEqual(['а']);
  });

  it('черновик не пишется, пока день грузится, и пишется после загрузки', async () => {
    let resolve!: (v: GratitudeDiaryEntry[]) => void;
    const load = vi.fn(
      () => new Promise<GratitudeDiaryEntry[]>((r) => (resolve = r)),
    );
    const { result } = renderHook(() =>
      useGratitudeItems({ date: '2026-10-18', load }),
    );
    expect(localStorage.getItem('diary_draft_gratitude')).toBeNull();
    await act(async () => resolve([entry('2026-10-18', ['утро'])]));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const draft = JSON.parse(localStorage.getItem('diary_draft_gratitude')!);
    expect(draft.data.items).toEqual(['утро', '', '']);
  });

  it('с existingItems черновик не пишется', () => {
    renderHook(() =>
      useGratitudeItems({
        date: '2026-10-18',
        existingItems: ['а'],
        load: vi.fn(),
      }),
    );
    expect(localStorage.getItem('diary_draft_gratitude')).toBeNull();
  });
});
