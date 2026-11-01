// @vitest-environment jsdom
// «Кто видит записи дневника» (оба фронта): до ответа и при сбое — null, то
// есть обещание приватности не показывается вовсе; настройки спрашиваются,
// только когда терапевт подключён.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDiaryAccess } from './useDiaryAccess';
import type { TherapyRelationInfo } from '../apiTypes';

const relation: TherapyRelationInfo = {
  role: 'client',
  status: 'active',
  partnerName: 'Анна',
  partnerId: 42,
  code: 'X',
  nextSession: null,
};

describe('useDiaryAccess', () => {
  it('терапевта нет — «private», настройки не спрашиваются', async () => {
    const loadSettings = vi.fn(async () => ({}));
    const { result } = renderHook(() =>
      useDiaryAccess(async () => null, loadSettings),
    );
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe('private'));
    expect(loadSettings).not.toHaveBeenCalled();
  });

  it('терапевт подключён и видит — «therapist-sees»; доступ закрыт — «therapist-hidden»', async () => {
    const sees = renderHook(() =>
      useDiaryAccess(
        async () => relation,
        async () => ({ therapistShareCards: true }),
      ),
    );
    await waitFor(() => expect(sees.result.current).toBe('therapist-sees'));
    const hidden = renderHook(() =>
      useDiaryAccess(
        async () => relation,
        async () => ({ therapistShareCards: false }),
      ),
    );
    await waitFor(() => expect(hidden.result.current).toBe('therapist-hidden'));
  });

  it('сбой загрузки — null, в том числе синхронный бросок загрузчика', async () => {
    const failed = renderHook(() =>
      useDiaryAccess(
        async () => {
          throw new Error('x');
        },
        async () => ({}),
      ),
    );
    const thrown = renderHook(() =>
      useDiaryAccess(
        () => {
          throw new Error('sync');
        },
        async () => ({}),
      ),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(failed.result.current).toBeNull();
    expect(thrown.result.current).toBeNull();
  });

  it('ответ после размонтирования не трогает состояние', async () => {
    let resolve!: (v: TherapyRelationInfo | null) => void;
    const pending = new Promise<TherapyRelationInfo | null>((r) => {
      resolve = r;
    });
    const { result, unmount } = renderHook(() =>
      useDiaryAccess(
        () => pending,
        async () => ({}),
      ),
    );
    unmount();
    resolve(null);
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });
});
