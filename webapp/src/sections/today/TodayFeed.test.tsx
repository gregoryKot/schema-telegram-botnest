// @vitest-environment jsdom
// Лента «Сегодня»: у каждой строки справа подпись вида, включая трекер.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TodayFeed } from './TodayFeed';
import type { FeedEntry } from './todayFeed';

afterEach(cleanup);

const entries: FeedEntry[] = [
  { key: 'schema-1', kind: 'schema', time: '14:30', text: 'Опоздал на встречу', sortKey: '2026-10-27T14:30:00Z' },
  { key: 'tracker', kind: 'tracker', time: '', text: 'Трекер: 2 из 5', sortKey: '' },
];

function setup(onOpenTrackerHistory = vi.fn(), onOpenDiaries = vi.fn()) {
  render(<TodayFeed entries={entries} loaded onOpenDiaries={onOpenDiaries} onOpenTrackerHistory={onOpenTrackerHistory} onAll={vi.fn()} />);
  return { onOpenTrackerHistory, onOpenDiaries };
}

describe('TodayFeed', () => {
  it('у записи дневника подпись «Схема», у строки трекера — «Трекер»', () => {
    setup();
    expect(screen.getByText('Схема', { selector: '.ct-feed-kind' })).toBeTruthy();
    expect(screen.getByText('Трекер', { selector: '.ct-feed-kind' })).toBeTruthy();
  });

  it('строка трекера ведёт в историю трекера, запись — в записи', () => {
    const h = setup();
    fireEvent.click(screen.getByText('Трекер: 2 из 5'));
    expect(h.onOpenTrackerHistory).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Опоздал на встречу'));
    expect(h.onOpenDiaries).toHaveBeenCalledTimes(1);
  });
});
