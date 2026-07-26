import { describe, it, expect } from 'vitest';
import { buildJourneySharePayload } from '../../../shared/src/journey/journeyShare';
import type { JourneyItem } from '../../../shared/src/journey/journeyMeta';

const items: JourneyItem[] = [
  { type: 'mode_diary', at: '2026-07-20T10:00:00Z', id: 1 },
  { type: 'gratitude', at: '2026-07-19T10:00:00Z', id: 2 },
  { type: 'tracker_day', at: '2026-07-18T10:00:00Z' },
] as JourneyItem[];
const noSub = () => null;

describe('buildJourneySharePayload — лента по периоду', () => {
  it('всё время: заголовок «Мой путь», счётчик = total', () => {
    const p = buildJourneySharePayload(
      { kind: 'feed' },
      items,
      99,
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
      noSub,
      'link',
      'month',
    );
    expect(p.title).toBe('Мой месяц');
    expect(p.filename).toBe('journey-month.png');
    expect(p.shareText).toContain('Мой месяц');
  });
});
