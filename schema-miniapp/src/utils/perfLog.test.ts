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
  startTimerMonitor,
  watchVisibility,
  getTimerJankSummary,
  runMicroBench,
  scheduleBenchmarks,
  _benchSink,
  getTaps,
  getMarks,
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
      { target: 'help', atMs: 1000, ms: 520, delayMs: 0, cold: true },
    ]);
  });

  it('event.timeStamp раньше запуска обработчика — разница записана как очередь', () => {
    // Палец коснулся на 1000, обработчик запустился на 3900 (поток был
    // занят), кадр отрисован на 3903: итог 2903мс, из них очередь 2900.
    mockNow(3900, 3903);
    tapStart('help', 1000);
    tapDone('help', false);
    expect(getTaps()).toEqual([
      { target: 'help', atMs: 1000, ms: 2903, delayMs: 2900, cold: false },
    ]);
  });

  it('неправдоподобный timeStamp (эпоха-время, будущее) отбрасывается', () => {
    mockNow(5000, 5010);
    tapStart('help', 1756180000000); // epoch-мс из старых WebKit
    tapDone('help', false);
    expect(getTaps()[0]).toMatchObject({ atMs: 5000, ms: 10, delayMs: 0 });
    mockNow(6000, 6010);
    tapStart('today', 7000); // «касание из будущего»
    tapDone('today', false);
    expect(getTaps()[1]).toMatchObject({ atMs: 6000, ms: 10, delayMs: 0 });
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

  it('собирает метки, блоки (по одному с моментом) и тапы с разбором очереди', () => {
    mockNow(300);
    perfMark('js');
    recordJank(5000, 400);
    mockNow(8100, 9240);
    tapStart('schemas', 8000);
    tapDone('schemas', true);
    const report = formatReport();
    expect(report).toContain('js 0.3с');
    expect(report).toContain('1 шт, 0.4с всего');
    expect(report).toContain('блок на 5.0с: 400мс');
    expect(report).toContain(
      'тап Паттерны на 8.0с: 1240мс (очередь 100 + экран 1140, сборка)',
    );
  });
});

describe('таймер-монитор (независимый от кадров)', () => {
  it('при выключенной панели не заводит интервал', () => {
    vi.useFakeTimers();
    startTimerMonitor();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('пауза между тиками больше 300мс записывается отдельно от кадров', () => {
    setPerfHudEnabled(true);
    vi.useFakeTimers();
    // старт → тик через 100мс (норма) → тик, пришедший на 1.5с позже
    mockNow(0, 100, 1600);
    startTimerMonitor();
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
    expect(getTimerJankSummary()).toEqual({ count: 1, totalMs: 1500 });
    expect(getJankSummary()).toEqual({ count: 0, totalMs: 0 });
  });
});

describe('слежка за видимостью', () => {
  it('при включённой панели пишет метку состояния и реагирует на смену', () => {
    setPerfHudEnabled(true);
    watchVisibility();
    expect(
      getMarks().some((m) => /^видимость:visible[+-]фокус$/.test(m.name)),
    ).toBe(true);
    const before = getMarks().length;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getMarks().length).toBe(before + 1);
  });

  it('при выключенной — молчит', () => {
    watchVisibility();
    expect(getMarks()).toEqual([]);
  });
});

describe('бенчмарк движка', () => {
  it('runMicroBench возвращает положительное время и не выбрасывается DCE', () => {
    const ms = runMicroBench();
    expect(ms).toBeGreaterThan(0);
    expect(typeof _benchSink()).toBe('number');
  });

  it('scheduleBenchmarks при выключенной панели не планирует таймеры', () => {
    vi.useFakeTimers();
    scheduleBenchmarks();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('при включённой панели бенчмарк оставляет метку с результатом', () => {
    setPerfHudEnabled(true);
    vi.useFakeTimers();
    scheduleBenchmarks();
    vi.advanceTimersByTime(3_000);
    vi.useRealTimers();
    expect(getMarks().some((m) => /^бенч1=\d+мс$/.test(m.name))).toBe(true);
  });
});
