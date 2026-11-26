// @vitest-environment jsdom
// E5 аудита 2026-11: тепловая карта брала «сегодня» по UTC, а сервер кладёт
// дни истории по поясу человека. В Москве с 00:00 до 03:00 сегодняшняя клетка
// считалась будущей, а сетка стояла на вчерашнем дне. Плюс useMemo без дня в
// зависимостях: вкладка, открытая за полночь, жила во вчерашнем дне до
// перезагрузки. Проверяем местный день в каждой зоне и переход через полночь.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ActivityHeatmap } from './ActivityHeatmap';
import { forEachTimeZone, withTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const LEVELS = new Map([['2026-11-07', 3]]);

function cell(container: HTMLElement, dateStr: string): Element | undefined {
  // Будущая клетка без title — по нему видно, что день уже наступил.
  return container.querySelector(`.cpf-heat-grid [title="${dateStr}"]`) ?? undefined;
}

function renderHeatmap() {
  return render(<ActivityHeatmap levels={LEVELS} activeDates={new Set(['2026-11-07'])} totalDays={1} />);
}

describe('ActivityHeatmap — «сегодня» — местный день человека', () => {
  it('00:30 по местному времени (Москва и ещё четыре зоны): вчерашний день заполнен, сегодняшний не будущий', () => {
    const check = (tz: string) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 8, 0, 30)); // вс 8 ноября, 00:30 в зоне tz
      const { container, unmount } = renderHeatmap();
      expect(cell(container, '2026-11-07')?.className, tz).toContain('cpf-heat--3');
      expect(cell(container, '2026-11-08'), tz).toBeDefined();
      unmount();
      vi.useRealTimers();
    };
    withTimeZone('Europe/Moscow', () => check('Europe/Moscow'));
    forEachTimeZone(check);
  });

  it('вкладка, открытая за полночь: после 00:00 сегодняшняя клетка наступает без перезагрузки', () => {
    forEachTimeZone((tz) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 7, 23, 50));
      const { container, rerender, unmount } = renderHeatmap();
      expect(cell(container, '2026-11-08'), tz).toBeUndefined();
      vi.setSystemTime(new Date(2026, 10, 8, 0, 10));
      rerender(<ActivityHeatmap levels={LEVELS} activeDates={new Set(['2026-11-07'])} totalDays={1} />);
      expect(cell(container, '2026-11-08'), tz).toBeDefined();
      unmount();
      vi.useRealTimers();
    });
  });
});
