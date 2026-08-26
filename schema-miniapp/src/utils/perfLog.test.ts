// @vitest-environment jsdom
// Журнал замеров скорости (perfLog.ts) — панель PerfHud для отладки на
// устройстве владельца, разбор «первую минуту тормозит» 2026-08-26.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPerfHudEnabled,
  setPerfHudEnabled,
  perfMark,
  tapStart,
  tapDone,
  recordJank,
  startJankMonitor,
  getTaps,
  getJankSummary,
  formatReport,
  _resetPerfLog,
} from './perfLog';

beforeEach(() => {
  _resetPerfLog();
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const mockNow = (...values: number[]) => {
  const spy = vi.spyOn(performance, 'now');
  for (const v of values) spy.mockReturnValueOnce(v);
  return spy;
};

describe('переключатель панели', () => {
  it('по умолчанию выключена, включение переживает перезапуск (localStorage)', () => {
    expect(isPerfHudEnabled()).toBe(false);
    setPerfHudEnabled(true);
    expect(isPerfHudEnabled()).toBe(true);
    expect(localStorage.getItem('perf_hud_on')).toBe('1');
  });
});

describe('замер тапа', () => {
  it('tapStart→tapDone по одной вкладке даёт длительность и момент касания', () => {
    mockNow(1000, 1520);
    tapStart('help');
    tapDone('help', true);
    expect(getTaps()).toEqual([
      { target: 'help', atMs: 1000, ms: 520, cold: true },
    ]);
  });

  it('tapDone без парного tapStart (свайп, начальный маунт) игнорируется', () => {
    tapDone('profile', false);
    expect(getTaps()).toEqual([]);
  });

  it('tapDone по другой вкладке сбрасывает незакрытый замер, а не приписывает ему чужое время', () => {
    mockNow(1000);
    tapStart('help');
    tapDone('profile', false);
    tapDone('help', false);
    expect(getTaps()).toEqual([]);
  });

  it('журнал ограничен последними 15 тапами', () => {
    for (let i = 0; i < 20; i++) {
      mockNow(i * 100, i * 100 + 10);
      tapStart('today');
      tapDone('today', false);
    }
    expect(getTaps()).toHaveLength(15);
    expect(getTaps()[0].atMs).toBe(500);
  });
});

describe('монитор кадров', () => {
  it('при выключенной панели даже не планирует rAF', () => {
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    startJankMonitor();
    expect(raf).not.toHaveBeenCalled();
  });

  it('дыра между кадрами больше 100мс записывается как блок', () => {
    setPerfHudEnabled(true);
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb);
      return queue.length;
    });
    // старт → кадр через 16мс (норма) → кадр через 250мс (блок)
    mockNow(0, 16, 266);
    startJankMonitor();
    queue.shift()!(0);
    queue.shift()!(0);
    expect(getJankSummary()).toEqual({ count: 1, totalMs: 250 });
  });
});

describe('отчёт', () => {
  it('пустое состояние — без NaN и мусора', () => {
    const report = formatReport();
    expect(report).toContain('тапов по вкладкам ещё не было');
    expect(report).not.toContain('NaN');
  });

  it('собирает метки, блоки и тапы человеческими словами', () => {
    mockNow(300);
    perfMark('js');
    recordJank(5000, 400);
    mockNow(8000, 9240);
    tapStart('schemas');
    tapDone('schemas', true);
    const report = formatReport();
    expect(report).toContain('js 0.3с');
    expect(report).toContain('1 шт, 0.4с всего');
    expect(report).toContain('тап Паттерны на 8.0с: 1240мс (сборка)');
  });
});
