// @vitest-environment jsdom
// Состояние блока «поделиться разбором»: setShare переключает открытый
// вариант, флаги и пропсы приходят из phraseCheckShareOptions (он покрыт
// phraseCheckFullCard.test.ts) — здесь проверяем саму обёртку с useState.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhraseCheckShare } from './usePhraseCheckShare';

const LINK = 't.me/Bot';

describe('usePhraseCheckShare', () => {
  it('изначально ничего не открыто, setShare переключает вариант', () => {
    const { result } = renderHook(() =>
      usePhraseCheckShare(
        'ни на что не гожусь',
        ['goal'],
        'вышло неточно',
        LINK,
      ),
    );
    expect(result.current.share).toBeNull();
    act(() => result.current.setShare('full'));
    expect(result.current.share).toBe('full');
    act(() => result.current.setShare(null));
    expect(result.current.share).toBeNull();
  });

  it('оба варианта доступны, когда есть фраза и переписанный вариант', () => {
    const { result } = renderHook(() =>
      usePhraseCheckShare('фраза', ['goal'], 'переписанная', LINK),
    );
    expect(result.current.hasShort).toBe(true);
    expect(result.current.hasFull).toBe(true);
    expect(result.current.shortProps?.filename).toBe('phrase-check.png');
    expect(result.current.fullProps?.filename).toBe('phrase-check-full.png');
  });

  it('без переписанной фразы остаётся только полный разбор', () => {
    const { result } = renderHook(() =>
      usePhraseCheckShare('фраза', [], null, LINK),
    );
    expect(result.current.hasShort).toBe(false);
    expect(result.current.shortProps).toBeNull();
    expect(result.current.hasFull).toBe(true);
  });
});
