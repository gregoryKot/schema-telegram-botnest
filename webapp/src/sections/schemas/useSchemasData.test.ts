// @vitest-environment jsdom
// «Мои паттерны» под открытым тестом YSQ (QA 2026-10-26): после «✕» карточка
// звала «Начать тест», а «Продолжить (N из 116)» появлялось только после
// перезагрузки — прогресс грузился один раз при открытии экрана.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { clearYsqProgress, writeYsqProgress } from '../../../../shared/src/hooks/ysqProgressStore';

vi.mock('../../api', () => ({
  api: {
    getProfile: vi.fn().mockResolvedValue({ mySchemaIds: [], myModeIds: [], ysq: null }),
    getYsqHistory: vi.fn().mockResolvedValue([]),
    getYsqProgress: vi.fn().mockResolvedValue(null),
    listMyModeMaps: vi.fn().mockResolvedValue([]),
    updateSettings: vi.fn().mockResolvedValue({}),
  },
  reportClientError: vi.fn(),
}));
import { useSchemasData } from './useSchemasData';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('useSchemasData — прогресс теста YSQ живой', () => {
  it('ответы в тесте поверх экрана — «продолжить (5 из 116)» без перезагрузки; сдал — снова «начать»', async () => {
    const { result } = renderHook(() => useSchemasData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ysqProgressAnswered).toBeNull();

    act(() => writeYsqProgress([4, 4, 4, 4, 4, ...Array(111).fill(0)], 5));
    expect(result.current.ysqProgressAnswered).toBe(5);

    act(() => clearYsqProgress());
    expect(result.current.ysqProgressAnswered).toBeNull();
  });
});
