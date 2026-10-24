// @vitest-environment jsdom
// Переключатели экспериментов панели замеров (perfExperiments.ts) — A/B
// кандидатов метронома ~1.5с прямо на устройстве владельца (разбор
// 2026-08-26: замирает весь событийный цикл, только пока экран виден).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isExperimentOn,
  toggleExperiment,
  applyExperiments,
} from './perfExperiments';
import { setPerfHudEnabled, getMarks, _resetPerfLog } from './perfLog';

beforeEach(() => {
  _resetPerfLog();
  localStorage.clear();
});

describe('эксперименты (A/B на устройстве)', () => {
  afterEach(() => {
    document.head.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('applyExperiments при выключенной панели не вкалывает стили', () => {
    localStorage.setItem('perf_exp_noanim', '1');
    applyExperiments();
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('включённый эксперимент вкалывает CSS и помечается в метках', () => {
    setPerfHudEnabled(true);
    localStorage.setItem('perf_exp_noanim', '1');
    applyExperiments();
    const css = document.head.querySelector('style')?.textContent ?? '';
    expect(css).toContain('animation:none');
    expect(getMarks().some((m) => m.name === 'экспер:noanim')).toBe(true);
    // Выключенный сосед не вкалывается.
    expect(css).not.toContain('backdrop-filter');
    expect(document.head.querySelectorAll('style')).toHaveLength(1);
  });

  it('toggleExperiment переключает флаг и перезагружает страницу', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
    });
    expect(isExperimentOn('noblur')).toBe(false);
    toggleExperiment('noblur');
    expect(isExperimentOn('noblur')).toBe(true);
    toggleExperiment('noblur');
    expect(isExperimentOn('noblur')).toBe(false);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
