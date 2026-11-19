// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { LOW_PHONE_MEDIA, useLowPhone } from './useLowPhone';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useLowPhone', () => {
  it('условие в CSS вопроса трекера — то же, что в хуке', () => {
    const css = readFileSync(resolve(__dirname, '../styles/tracker-question.css'), 'utf8');
    expect(css).toContain(`@media ${LOW_PHONE_MEDIA} {`);
  });

  it('следит за окном: низкое — true, после поворота — false', () => {
    let low = true;
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === LOW_PHONE_MEDIA && low }));
    const { result } = renderHook(() => useLowPhone());
    expect(result.current).toBe(true);
    low = false;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });

  it('без matchMedia — обычная раскладка', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useLowPhone()).result.current).toBe(false);
  });
});
