// @vitest-environment jsdom
// Панель замеров (PerfHud.tsx) — видна только при включённом тумблере
// (5 тапов по строке версии в BuildInfoLine), см. perfLog.ts.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PerfHud } from './PerfHud';
import {
  setPerfHudEnabled,
  tapStart,
  tapDone,
  _resetPerfLog,
} from '../utils/perfLog';

beforeEach(() => {
  cleanup();
  _resetPerfLog();
  localStorage.clear();
});

describe('PerfHud', () => {
  it('при выключенной панели не рендерит ничего', () => {
    const { container } = render(<PerfHud />);
    expect(container.innerHTML).toBe('');
  });

  it('включена — показывает тапы и сводку блоков', () => {
    setPerfHudEnabled(true);
    const spy = vi.spyOn(performance, 'now');
    spy.mockReturnValueOnce(8000).mockReturnValueOnce(9240);
    tapStart('help');
    tapDone('help', true);
    spy.mockRestore();
    render(<PerfHud />);
    expect(
      screen.getByText(
        /Помощь на 8\.0с: 1240мс \(очередь 0 \+ экран 1240, сборка\)/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/блоки >100мс/)).toBeTruthy();
  });

  it('«Скопировать» кладёт отчёт в буфер обмена', async () => {
    setPerfHudEnabled(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<PerfHud />);
    fireEvent.click(screen.getByText('Скопировать'));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('тапов по вкладкам ещё не было'),
    );
  });

  it('«Выключить» прячет панель сразу', () => {
    setPerfHudEnabled(true);
    const { container } = render(<PerfHud />);
    fireEvent.click(screen.getByText('Выключить'));
    expect(container.innerHTML).toBe('');
  });
});
