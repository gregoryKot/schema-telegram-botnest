// @vitest-environment jsdom
// usePerfTapTracking — замыкание замера тапа: после смены section двойной
// rAF (кадр отрисован) завершает измерение, начатое в BottomNav (perfLog).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePerfTapTracking } from './usePerfTapTracking';
import { tapStart, getTaps, _resetPerfLog } from './perfLog';
import type { Section } from '../components/BottomNav';

let rafQueue: FrameRequestCallback[] = [];

beforeEach(() => {
  _resetPerfLog();
  localStorage.clear();
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

const flushRaf = () => {
  while (rafQueue.length > 0) rafQueue.shift()!(0);
};

const renderTracking = (initial: Section, prerendered: Set<Section>) =>
  renderHook(
    ({ section }: { section: Section }) =>
      usePerfTapTracking(section, prerendered, false),
    { initialProps: { section: initial } },
  );

describe('usePerfTapTracking', () => {
  it('тап по несобранной вкладке помечается «сборка» (cold)', () => {
    const { rerender } = renderTracking('today', new Set());
    flushRaf();
    tapStart('help');
    rerender({ section: 'help' });
    flushRaf();
    expect(getTaps()).toHaveLength(1);
    expect(getTaps()[0]).toMatchObject({ target: 'help', cold: true });
  });

  it('прогретая заранее вкладка — «показ» (не cold)', () => {
    const { rerender } = renderTracking('today', new Set<Section>(['help']));
    flushRaf();
    tapStart('help');
    rerender({ section: 'help' });
    flushRaf();
    expect(getTaps()[0]).toMatchObject({ target: 'help', cold: false });
  });

  it('возврат на уже открывавшуюся вкладку — тоже «показ»', () => {
    const { rerender } = renderTracking('today', new Set());
    flushRaf();
    tapStart('help');
    rerender({ section: 'help' });
    flushRaf();
    tapStart('today');
    rerender({ section: 'today' });
    flushRaf();
    expect(getTaps()[1]).toMatchObject({ target: 'today', cold: false });
  });

  it('начальный маунт без тапа ничего не записывает', () => {
    renderTracking('today', new Set());
    flushRaf();
    expect(getTaps()).toEqual([]);
  });
});
