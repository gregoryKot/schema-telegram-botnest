// @vitest-environment jsdom
// useDayNote — загрузка заметки дня для листа заметки и «Истории» (аудит 2026-11, E7/E8).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../api', () => ({ api: { getNote: vi.fn() } }));
import { api } from '../api';
import { useDayNote } from './useDayNote';

const getNote = api.getNote as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => getNote.mockReset());

describe('useDayNote', () => {
  it('без дня — запроса нет, статус «загрузка»', () => {
    const { result } = renderHook(() => useDayNote(undefined));
    expect(getNote).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');
    expect(result.current.note).toBeNull();
  });

  it('ответ сервера — ready с текстом и тегами; null-теги — пустой список', async () => {
    getNote.mockResolvedValue({ text: 'Текст', tags: null });
    const { result } = renderHook(() => useDayNote('2026-07-20'));
    await act(async () => {});
    expect(result.current).toMatchObject({ status: 'ready', note: { text: 'Текст', tags: [] } });
  });

  it('сбой перезагрузки того же дня держит прежний текст и говорит error', async () => {
    getNote.mockResolvedValueOnce({ text: 'Было', tags: [] }).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useDayNote('2026-07-20'));
    await act(async () => {});
    act(() => result.current.reload());
    expect(result.current.status).toBe('loading');
    expect(result.current.note?.text).toBe('Было');
    await act(async () => {});
    expect(result.current.status).toBe('error');
    expect(result.current.note?.text).toBe('Было');
  });

  it('сбой загрузки нового дня — error без чужого текста', async () => {
    getNote.mockResolvedValueOnce({ text: 'Двадцатое', tags: [] }).mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook(({ d }) => useDayNote(d), { initialProps: { d: '2026-07-20' } });
    await act(async () => {});
    rerender({ d: '2026-07-21' });
    expect(result.current.note).toBeNull();
    await act(async () => {});
    expect(result.current).toMatchObject({ status: 'error', note: null });
  });
});
