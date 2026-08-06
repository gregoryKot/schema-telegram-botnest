// @vitest-environment jsdom
// Canvas-конфетти (нейроинклюзивность): при сниженной анимации не запускается
// вовсе — это ветвление было единственным тестируемым без канваса. Здесь
// добавлен полный прогон анимации через подменённый 2d-контекст (jsdom его не
// реализует, поэтому canvas.getContext замокан на прототипе — как в
// share/cards/canvas.test-helpers.ts) и подменённый requestAnimationFrame:
// синхронный мок прогоняет кадры до конца без реальных таймеров.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useConfetti } from './useConfetti';
import * as reducedMotion from '../utils/reducedMotion';

function fakeCtx() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };
}

function TestCanvas({ onDone }: { onDone: () => void }) {
  const canvasRef = useConfetti(onDone);
  return <canvas ref={canvasRef} data-testid="confetti-canvas" />;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useConfetti', () => {
  it('возвращает ref для canvas', () => {
    vi.spyOn(reducedMotion, 'isReducedMotion').mockReturnValue(true);
    const { result } = renderHook(() => useConfetti(vi.fn()));
    expect(result.current).toHaveProperty('current');
  });

  it('при isReducedMotion=true эффект выходит раньше обращения к onDone', () => {
    vi.spyOn(reducedMotion, 'isReducedMotion').mockReturnValue(true);
    const onDone = vi.fn();
    renderHook(() => useConfetti(onDone));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('при isReducedMotion=false и canvasRef=null (компонент не смонтирован) эффект не падает', () => {
    vi.spyOn(reducedMotion, 'isReducedMotion').mockReturnValue(false);
    expect(() => renderHook(() => useConfetti(vi.fn()))).not.toThrow();
  });

  it('полный прогон: канвас размечен под окно, кадры очищаются и рисуются, onDone зовётся ровно раз по завершении', () => {
    vi.spyOn(reducedMotion, 'isReducedMotion').mockReturnValue(false);
    const ctx = fakeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    // Синхронный raf: каждый кадр гонится сразу же, без реальных таймеров —
    // анимация из ~80 частиц с угасанием после 60-го кадра завершается
    // за конечное число рекурсивных вызовов.
    let frames = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        frames++;
        cb(0);
        return frames;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const onDone = vi.fn();
    render(<TestCanvas onDone={onDone} />);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(ctx.clearRect).toHaveBeenCalled();
    // Первый вызов каждого кадра стирает канвас целиком — от нуля до его
    // собственных width/height (не жёстко захардкоженных чисел).
    const [firstCall] = ctx.clearRect.mock.calls;
    expect(firstCall[0]).toBe(0);
    expect(firstCall[1]).toBe(0);
    expect(firstCall[2]).toBeGreaterThan(0);
    expect(firstCall[3]).toBeGreaterThan(0);
    expect(ctx.fillRect).toHaveBeenCalled();
    // Частицы красятся в один из объявленных hex-цветов конфетти, не в
    // CSS-переменную (canvas fillStyle их не понимает — см. комментарий в источнике).
    expect(ctx.fillStyle).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('размонтирование до завершения анимации отменяет именно тот requestAnimationFrame, что был запущен', () => {
    vi.spyOn(reducedMotion, 'isReducedMotion').mockReturnValue(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fakeCtx() as unknown as CanvasRenderingContext2D,
    );
    // На этот раз raf ничего не выполняет — просто выдаёт id, как в браузере
    // между кадрами: анимация «подвисает» на первом кадре, что и проверяем.
    const raf = vi.fn(() => 42);
    const caf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);

    const onDone = vi.fn();
    const { unmount } = render(<TestCanvas onDone={onDone} />);
    expect(raf).toHaveBeenCalledTimes(1);

    unmount();

    expect(caf).toHaveBeenCalledWith(42);
    expect(onDone).not.toHaveBeenCalled();
  });
});
