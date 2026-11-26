// @vitest-environment jsdom
// Таймлайн «Моего пути»: группы месяцев, каждая запись — кликабельная кнопка
// со знаком от площадки (rowArt)/названием/датой (+ подпись, если subtitle её вернул). Клик зовёт
// onOpenItem с исходным item. Эмодзи journeyMeta в ленту не идут — ни с rowArt, ни без него.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { JourneyTimeline } from './JourneyTimeline';
import {
  JOURNEY_TYPE_META,
  groupJourneyByMonth,
  type JourneyItem,
} from './journeyMeta';

afterEach(() => {
  cleanup();
});

const ITEMS: JourneyItem[] = [
  { type: 'gratitude', at: '2026-07-21T10:00:00Z', id: 1 },
  { type: 'tracker_day', at: '2026-07-20T10:00:00Z', id: 2 },
];

describe('JourneyTimeline', () => {
  it('рендерит записи с названием и датой', () => {
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

  it('без rowArt строка без картинки и без эмодзи; шеврон — SVG, не глиф', () => {
    const all = Object.keys(JOURNEY_TYPE_META).map((type, i) => ({
      type,
      at: '2026-07-21T10:00:00Z',
      id: i,
    }));
    const { container } = render(
      <JourneyTimeline
        groups={groupJourneyByMonth(all, new Date('2026-07-21'))}
        subtitle={() => null}
        onOpenItem={vi.fn()}
      />,
    );
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(container.textContent).not.toContain('›');
    expect(container.querySelectorAll('.jr-row svg.jr-chev').length).toBe(
      all.length,
    );
  });

  it('rowArt площадки получает каждую строку и встаёт в неё', () => {
    const rowArt = vi.fn((item: JourneyItem) => (
      <i data-testid="art">{item.type}</i>
    ));
    render(
      <JourneyTimeline
        groups={groupJourneyByMonth(ITEMS, new Date('2026-07-21'))}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        rowArt={rowArt}
      />,
    );
    expect(screen.getAllByTestId('art').map((n) => n.textContent)).toEqual([
      'gratitude',
      'tracker_day',
    ]);
  });
});
