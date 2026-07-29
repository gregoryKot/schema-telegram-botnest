import { describe, it, expect } from 'vitest';
import { buildJourneySharePayload } from '../../../shared/src/journey/journeyShare';
import type { JourneyItem } from '../../../shared/src/journey/journeyMeta';

const items: JourneyItem[] = [
  { type: 'mode_diary', at: '2026-07-20T10:00:00Z', id: 1 },
  { type: 'gratitude', at: '2026-07-19T10:00:00Z', id: 2 },
  { type: 'tracker_day', at: '2026-07-18T10:00:00Z' },
] as JourneyItem[];
const noSub = () => null;
// Сигнатура: (share, items, total, stats, subtitle, link, period) —
// stats нужен карточке итогов (kind 'totals'), для ленты пустой ок.
const noStats: [] = [];

describe('buildJourneySharePayload — карточка шага', () => {
  const trackerItem: JourneyItem = {
    type: 'tracker_day',
    at: '2026-07-20T10:00:00Z',
  };

  it('день трекера с оценками → радар, а не текстовая строка «Привязанность — 7»', () => {
    const p = buildJourneySharePayload(
      {
        kind: 'item',
        item: trackerItem,
        result: {
          parts: [{ text: 'Привязанность — 7' }],
          ratings: { attachment: 7 },
        },
      },
      items,
      99,
      noStats,
      noSub,
      'link',
    );
    expect(p.filename).toBe('journey-result.png');
    expect(p.eventKind).toBe('journey_item');
  });

  it('шаг без содержимого → карточка шага, а не результата', () => {
    const p = buildJourneySharePayload(
      { kind: 'item', item: items[1], result: null },
      items,
      99,
      noStats,
      noSub,
      'link',
    );
    expect(p.title).toBe('Шаг пути');
    expect(p.filename).toBe('journey-step.png');
  });

  it('шаг с текстовым содержимым (не трекер) → карточка-результат', () => {
    const p = buildJourneySharePayload(
      {
        kind: 'item',
        item: items[0],
        result: { parts: [{ title: 'Ситуация', text: 'x' }] },
      },
      items,
      99,
      noStats,
      noSub,
      'link',
    );
    expect(p.title).toBe('Результат');
    expect(p.filename).toBe('journey-result.png');
  });
});

describe('buildJourneySharePayload — лента по периоду', () => {
  it('всё время: заголовок «Мой путь», счётчик = total', () => {
    const p = buildJourneySharePayload(
      { kind: 'feed' },
      items,
      99,
      noStats,
      noSub,
      'link',
      'all',
    );
    expect(p.title).toBe('Мой путь');
    expect(p.filename).toBe('journey.png');
    expect(p.shareText).toContain('Мой путь');
    expect(p.shareText).toContain('99');
  });

  it('неделя: «Моя неделя», счётчик = число записей периода, свой файл', () => {
    const p = buildJourneySharePayload(
      { kind: 'feed' },
      items,
      99,
      noStats,
      noSub,
      'link',
      'week',
    );
    expect(p.title).toBe('Моя неделя');
    expect(p.filename).toBe('journey-week.png');
    expect(p.shareText).toContain('Моя неделя');
    // счётчик по периоду (items.length=3), не all-time (99)
    expect(p.shareText).toContain('3');
    expect(p.shareText).not.toContain('99');
  });

  it('месяц: «Мой месяц» + journey-month.png', () => {
    const p = buildJourneySharePayload(
      { kind: 'feed' },
      items,
      99,
      noStats,
      noSub,
      'link',
      'month',
    );
    expect(p.title).toBe('Мой месяц');
    expect(p.filename).toBe('journey-month.png');
    expect(p.shareText).toContain('Мой месяц');
  });
});
