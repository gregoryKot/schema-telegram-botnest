// @vitest-environment jsdom
// Состояние шита «поделиться записью режима»: setShare переключает
// открытый вариант, hasHealthy/hasFull/*Props идут напрямую из
// modeEntryShareOptions (уже покрыт modeEntryFullCard.test.ts) — здесь
// проверяем только сам хук-обёртку с useState.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModeEntryShare } from './useModeEntryShare';
import type { ModeEntryMode } from './cards/modeEntryCard';

const MODE: ModeEntryMode = {
  name: 'Уязвимый ребёнок',
  emoji: '🥹',
  groupName: 'Ребёнок',
  groupColor: '#5aa8f7',
};

describe('useModeEntryShare', () => {
  it('share=null изначально, setShare переключает открытый вариант', () => {
    const { result } = renderHook(() =>
      useModeEntryShare(MODE, 'я имею право на отдых', undefined, 't.me/Bot'),
    );
    expect(result.current.share).toBeNull();
    act(() => result.current.setShare('short'));
    expect(result.current.share).toBe('short');
    act(() => result.current.setShare(null));
    expect(result.current.share).toBeNull();
  });

  it('пробрасывает hasHealthy/hasFull из modeEntryShareOptions', () => {
    const { result } = renderHook(() =>
      useModeEntryShare(
        MODE,
        'я имею право на отдых',
        { situation: 'Позвонил папа' },
        't.me/Bot',
      ),
    );
    expect(result.current.hasHealthy).toBe(true);
    expect(result.current.hasFull).toBe(true);
    expect(result.current.shortProps).not.toBeNull();
    expect(result.current.fullProps).not.toBeNull();
  });

  it('без mode — обе опции недоступны', () => {
    const { result } = renderHook(() =>
      useModeEntryShare(undefined, 'текст', undefined, 't.me/Bot'),
    );
    expect(result.current.hasHealthy).toBe(false);
    expect(result.current.hasFull).toBe(false);
  });
});
