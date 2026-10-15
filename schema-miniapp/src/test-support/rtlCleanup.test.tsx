// @vitest-environment jsdom
// Пин механизма rtlCleanup.ts: тест НЕ вызывает cleanup сам — он проверяет,
// что afterEach из setupFiles отработал между it. Без setupFiles в конфиге
// второй и третий it краснеют. Порядок it внутри файла детерминирован.
import { describe, it, expect } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { useEffect } from 'react';

const state = { unmounted: false };

describe('rtlCleanup (setupFiles)', () => {
  it('рендерит разметку и оставляет её без ручного cleanup', () => {
    render(<div>leak</div>);
    expect(document.body.innerHTML).toContain('leak');
  });

  it('к следующему it DOM очищен', () => {
    expect(document.body.innerHTML).toBe('');
  });

  it('хук с эффектом размонтируется: функция очистки вызвана', () => {
    state.unmounted = false;
    renderHook(() =>
      useEffect(
        () => () => {
          state.unmounted = true;
        },
        [],
      ),
    );
    expect(state.unmounted).toBe(false);
  });

  it('функция очистки эффекта вызвана после предыдущего it', () => {
    expect(state.unmounted).toBe(true);
  });
});
