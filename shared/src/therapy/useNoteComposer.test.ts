// @vitest-environment jsdom
// «Новая заметка» по сессии (оба фронта). Инцидент 2026-10-26
// (docs/INCIDENTS.md): черновик переезжал к следующему клиенту, а ответ
// сохранения попадал в его список. Сценарии через фасады карточки — в
// useClientDetail.switch.test.ts обоих фронтендов; здесь — сам хук.
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNoteComposer } from './useNoteComposer';
import { todayStr } from '../utils/format';
import type { UserId } from '../userId';

const note = (id: number) => ({
  id,
  therapistId: 9,
  clientId: 1,
  date: '2026-10-26',
  text: 'т',
  createdAt: '2026-10-26T10:00:00Z',
});

function setup(openId: UserId | null = 1) {
  const ref = { current: openId };
  const create = vi.fn(async (_c: UserId, _d: string, _t: string) => note(5));
  const remove = vi.fn(async () => undefined);
  const view = renderHook(() => useNoteComposer(ref, { create, remove }));
  return { ...view, ref, create, remove };
}

describe('useNoteComposer', () => {
  it('сохраняет открытому клиенту, без даты — сегодняшним днём; черновик очищается', async () => {
    const { result, create } = setup();
    act(() => result.current.setNewNoteText('  наблюдения  '));
    await act(async () => {
      await result.current.addNote();
    });
    expect(create).toHaveBeenCalledWith(1, todayStr(), 'наблюдения');
    expect(result.current.notesPage.notes.map((n) => n.id)).toEqual([5]);
    expect(result.current.newNoteText).toBe('');
  });

  it('пустой текст или нет открытого клиента — ничего не отправляет', async () => {
    const empty = setup();
    act(() => empty.result.current.setNewNoteText('   '));
    await act(async () => {
      await empty.result.current.addNote();
    });
    expect(empty.create).not.toHaveBeenCalled();

    const none = setup(null);
    act(() => none.result.current.setNewNoteText('текст'));
    await act(async () => {
      await none.result.current.addNote();
    });
    expect(none.create).not.toHaveBeenCalled();
  });

  it('resetNotes обнуляет черновик, дату, ошибку и список', async () => {
    const { result } = setup();
    act(() => {
      result.current.setNewNoteText('черновик');
      result.current.setNewNoteDate('2026-10-20');
      result.current.setNoteError('ошибка');
    });
    act(() => result.current.resetNotes());
    expect([
      result.current.newNoteText,
      result.current.newNoteDate,
      result.current.noteError,
    ]).toEqual(['', '', '']);
  });

  it('отказ сохранения и удаления — текст ошибки у открытого клиента; после смены клиента — тишина', async () => {
    const { result, create, remove, ref } = setup();
    create.mockRejectedValueOnce(new Error('network'));
    act(() => result.current.setNewNoteText('текст'));
    await act(async () => {
      await result.current.addNote();
    });
    expect(result.current.noteError).toBe('Не удалось сохранить заметку');
    expect(result.current.noteSaving).toBe(false);

    remove.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      await result.current.removeNote(9);
    });
    expect(result.current.noteError).toBe('Не удалось удалить заметку');

    act(() => result.current.resetNotes());
    remove.mockImplementationOnce(async () => {
      ref.current = 2;
      throw new Error('network');
    });
    await act(async () => {
      await result.current.removeNote(9);
    });
    expect(result.current.noteError).toBe('');
  });
});
