// @vitest-environment jsdom
// Canvas-конфетти (нейроинклюзивность): при сниженной анимации не запускается
// вовсе — только это поведенческое ветвление реально тестируемо без полного
// canvas-2d-мока (jsdom не рисует). Полный прогон анимации оставлен вне теста
// (canvas.getContext('2d') в jsdom не реализован).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConfetti } from './useConfetti';
import * as reducedMotion from '../utils/reducedMotion';

afterEach(() => {
  vi.restoreAllMocks();
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
});
