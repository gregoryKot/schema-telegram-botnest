// @vitest-environment jsdom
// useMyCards — читает UserSchemaNote/UserModeNote и оставляет ТОЛЬКО
// заполненные (правило «пусто = пусто», никаких выдуманных карточек).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const getSchemaNotes = vi.fn();
const getModeNotes = vi.fn();
vi.mock('../../api', () => ({
  api: {
    getSchemaNotes: (...a: unknown[]) => getSchemaNotes(...a),
    getModeNotes: (...a: unknown[]) => getModeNotes(...a),
  },
}));

import { useMyCards } from './useMyCards';

beforeEach(() => {
  getSchemaNotes.mockReset();
  getModeNotes.mockReset();
});

describe('useMyCards — схемы', () => {
  it('пустая заметка (все поля пустые) не попадает в список', async () => {
    getSchemaNotes.mockResolvedValue([
      {
        schemaId: 'abandonment',
        triggers: '',
        feelings: '   ',
        thoughts: '',
        origins: '',
        reality: '',
        healthyView: '',
        behavior: '',
        updatedAt: '2026-01-01',
      },
    ]);
    const { result } = renderHook(() => useMyCards('schema'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it('заполненная заметка попадает в список с именем/цветом/выжимкой', async () => {
    getSchemaNotes.mockResolvedValue([
      {
        schemaId: 'abandonment',
        triggers: 'Когда не отвечают',
        feelings: '',
        thoughts: '',
        origins: '',
        reality: '',
        healthyView: '',
        behavior: '',
        updatedAt: '2026-01-01',
      },
    ]);
    const { result } = renderHook(() => useMyCards('schema'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    const item = result.current.items[0];
    expect(item.id).toBe('abandonment');
    expect(item.excerpt).toBe('Когда не отвечают');
    expect(item.cardFields).toEqual([
      { label: 'Что включает', text: 'Когда не отвечают' },
    ]);
    expect(item.color).toBeTruthy();
    expect(item.name).toBeTruthy();
  });

  it('неизвестный schemaId (нет в справочнике) тихо отфильтровывается', async () => {
    getSchemaNotes.mockResolvedValue([
      {
        schemaId: 'no_such_schema',
        triggers: 'что-то',
        feelings: '',
        thoughts: '',
        origins: '',
        reality: '',
        healthyView: '',
        behavior: '',
        updatedAt: '2026-01-01',
      },
    ]);
    const { result } = renderHook(() => useMyCards('schema'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it('сеть упала → пустой список, а не зависшая загрузка', async () => {
    getSchemaNotes.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useMyCards('schema'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });
});

describe('useMyCards — режимы', () => {
  it('заполненная заметка режима попадает в список, поле needs подписано', async () => {
    getModeNotes.mockResolvedValue([
      {
        modeId: 'demanding_critic',
        triggers: '',
        feelings: '',
        thoughts: '',
        needs: 'Признание',
        behavior: '',
        origins: '',
        healthyView: '',
        updatedAt: '2026-01-01',
      },
    ]);
    const { result } = renderHook(() => useMyCards('mode'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].excerpt).toBe('Признание');
  });

  it('пустой список заметок → пустой список карточек (не выдуманные данные)', async () => {
    getModeNotes.mockResolvedValue([]);
    const { result } = renderHook(() => useMyCards('mode'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });
});
