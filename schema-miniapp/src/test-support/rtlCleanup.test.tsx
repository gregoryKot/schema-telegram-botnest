// @vitest-environment jsdom
// Пин механизма rtlCleanup.ts: тест НЕ вызывает cleanup сам — он проверяет,
// что afterEach из setupFiles отработал между it. Без setupFiles в конфиге
// второй и четвёртый it краснеют. Порядок it внутри файла детерминирован.
import { describe, it, expect, aroundAll } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { useEffect } from 'react';

const state = { unmounted: false, unmountTimerFired: false };

// Шов afterAll из setupFiles: aroundAll верхнего уровня оборачивает весь файл,
// включая afterAll из setup. Таймер, поставленный при размонтировании в
// последнем тесте, обязан успеть до сноса jsdom (tiptap, CI 2026-10-15).
// Без afterAll(settleUnmountTimers) в rtlCleanup.ts — красный: vitest не отдаёт
// макрозадачу между последним afterEach и концом aroundAll. Если обновление
// vitest начнёт её отдавать, пин станет ложно-зелёным: перепроверь его без
// afterAll.
aroundAll(async (runSuite) => {
  await runSuite();
  expect(state.unmountTimerFired).toBe(true);
});

function UnmountTimer() {
  useEffect(
    () => () => {
      setTimeout(() => {
        state.unmountTimerFired = true;
      }, 1);
    },
    [],
  );
  return null;
}

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

  it('последний тест: размонтирование ставит таймер на 1 мс', () => {
    render(<UnmountTimer />);
  });
});
