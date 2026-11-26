// @vitest-environment jsdom
// «Экспорт концепта» — общая механика обоих фронтендов: пустой концепт виден
// заранее (exportEmpty) и в буфер ничего не уходит; отмена системной шторки —
// штатный путь (текст в буфер, без отчёта), настоящий сбой шаринга — отчёт.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useConceptExport } from './useConceptExport';
import type { ConceptExportInput } from './conceptExport';

const input = (goals: string | null): ConceptExportInput => ({
  client: { telegramId: 7, name: 'Анна', clientAlias: null },
  concept: { goals, updatedAt: '2026-10-01T00:00:00.000Z' },
  localConcept: {},
  activeSchemaIds: [],
  activeModeIds: [],
});

let writeText: ReturnType<typeof vi.fn>;
const setShare = (share: unknown) =>
  Object.defineProperty(navigator, 'share', {
    value: share,
    configurable: true,
    writable: true,
  });

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  setShare(undefined);
});

describe('useConceptExport', () => {
  it('пустой концепт: exportEmpty, буфер не трогается', async () => {
    const { result } = renderHook(() => useConceptExport(input(null), vi.fn()));
    expect(result.current.exportEmpty).toBe(true);
    await act(() => result.current.handleExport());
    expect(writeText).not.toHaveBeenCalled();
  });

  it('без navigator.share — текст в буфере, exportCopied', async () => {
    const { result } = renderHook(() =>
      useConceptExport(input('цель'), vi.fn()),
    );
    expect(result.current.exportEmpty).toBe(false);
    await act(() => result.current.handleExport());
    expect(writeText.mock.calls[0][0]).toContain('ЦЕЛИ СХЕМА-ТЕРАПИИ\nцель');
    expect(result.current.exportCopied).toBe(true);
  });

  it('шторку закрыли (AbortError) — текст в буфер, отчёта нет', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('', 'AbortError')));
    const report = vi.fn();
    const { result } = renderHook(() =>
      useConceptExport(input('цель'), report),
    );
    await act(() => result.current.handleExport());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('шаринг упал по-настоящему — текст в буфер и отчёт наверх', async () => {
    setShare(vi.fn().mockRejectedValue(new Error('NotAllowedError')));
    const report = vi.fn();
    const { result } = renderHook(() =>
      useConceptExport(input('цель'), report),
    );
    await act(() => result.current.handleExport());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.stringContaining('share failed'),
    );
  });

  it('шаринг удался — буфер не трогается', async () => {
    setShare(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() =>
      useConceptExport(input('цель'), vi.fn()),
    );
    await act(() => result.current.handleExport());
    expect(writeText).not.toHaveBeenCalled();
  });
});
