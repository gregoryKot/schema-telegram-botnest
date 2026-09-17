// @vitest-environment jsdom
// Таймлайн «Моего пути»: группы месяцев, каждая запись — кликабельная кнопка
// с эмодзи/названием/датой (+ подпись, если subtitle её вернул). Клик зовёт
// onOpenItem с исходным item.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { JourneyTimeline } from './JourneyTimeline';
import { groupJourneyByMonth, type JourneyItem } from './journeyMeta';

afterEach(() => {
  cleanup();
});

const ITEMS: JourneyItem[] = [
  { type: 'gratitude', at: '2026-07-21T10:00:00Z', id: 1 },
  { type: 'tracker_day', at: '2026-07-20T10:00:00Z', id: 2 },
];

describe('JourneyTimeline', () => {
  it('рендерит записи с эмодзи, названием и датой', () => {
    const groups = groupJourneyByMonth(ITEMS, new Date('2026-07-21'));
    render(
      <JourneyTimeline
        groups={groups}
        subtitle={() => null}
        onOpenItem={vi.fn()}
      />,
    );
    expect(screen.getByText('Благодарность')).toBeTruthy();
    expect(screen.getByText('Трекер потребностей')).toBeTruthy();
  });

  it('подпись (subtitle) добавляется к дате через « · »', () => {
    const groups = groupJourneyByMonth([ITEMS[0]], new Date('2026-07-21'));
    render(
      <JourneyTimeline
        groups={groups}
        subtitle={() => 'Привязанность'}
        onOpenItem={vi.fn()}
      />,
    );
    expect(screen.getByText(/· Привязанность/)).toBeTruthy();
  });

  it('клик по записи зовёт onOpenItem с исходным item', () => {
    const onOpenItem = vi.fn();
    const groups = groupJourneyByMonth(ITEMS, new Date('2026-07-21'));
    render(
      <JourneyTimeline
        groups={groups}
        subtitle={() => null}
        onOpenItem={onOpenItem}
      />,
    );
    fireEvent.click(screen.getByText('Благодарность'));
    expect(onOpenItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, type: 'gratitude' }),
    );
  });

  it('незнакомый тип с бэка не роняет рендер (фолбэк UNKNOWN_META)', () => {
    const groups = groupJourneyByMonth(
      [{ type: 'future_unknown_type', at: '2026-07-21T10:00:00Z' }],
      new Date('2026-07-21'),
    );
    expect(() =>
      render(
        <JourneyTimeline
          groups={groups}
          subtitle={() => null}
          onOpenItem={vi.fn()}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText('Запись')).toBeTruthy();
  });
});
