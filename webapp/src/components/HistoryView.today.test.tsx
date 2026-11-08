// @vitest-environment jsdom
// E5 аудита 2026-11: «Сегодня» в «Истории» считалось по UTC и один раз при
// загрузке модуля (`TODAY_STR`). Сервер кладёт дни по поясу человека, поэтому
// в Москве с 00:00 до 03:00 вчерашний заполненный день совпадал с «сегодня»
// по UTC и показывался пустым (вместо его оценок — ещё пустые оценки нового
// дня), а в PWA, открытой за полночь, «сегодня» не менялось до перезагрузки.
//
// Модуль импортируется заново под поддельными часами: «сегодня», замёрзшее
// при импорте, иначе вычислилось бы по настоящим часам раннера и тест не
// видел бы ни UTC, ни заморозки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DayHistory, Need } from '../types';
import { forEachTimeZoneAsync } from '../../../shared/src/utils/timeZone.test-helpers';

vi.mock('../api', () => ({
  api: {
    getNote: vi.fn(() => Promise.resolve({ text: null, tags: [] })),
    saveNote: vi.fn(),
    trackEvent: vi.fn(),
    getStreak: vi.fn(() => Promise.resolve({ currentStreak: 0 })),
  },
  reportClientError: vi.fn(),
}));
HTMLElement.prototype.scrollIntoView = vi.fn();

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привяз.' },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автон.' },
];
// Вчерашний (7 ноября) день заполнен: индекс 7,5. Оценки нового дня — 2,5.
const HISTORY: DayHistory[] = [
  { date: '2026-11-07', ratings: { attachment: 9, autonomy: 6 } },
  { date: '2026-11-06', ratings: { attachment: 4, autonomy: 4 } },
];
const CURRENT = { attachment: 3, autonomy: 2 };

async function freshHistoryView() {
  vi.resetModules();
  return (await import('./HistoryView')).HistoryView;
}

async function inZone(tz: string, fn: () => Promise<void>) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    await fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('HistoryView — «сегодня» — местный день человека (E5)', () => {
  const yesterdayShowsOwnRatings = async (tz: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 0, 30)); // 00:30 8 ноября в зоне tz
    const HistoryView = await freshHistoryView();
    const onBackfill = vi.fn();
    const { unmount } = render(
      <MemoryRouter>
        <HistoryView needs={NEEDS} history={HISTORY} currentRatings={CURRENT} onBackfill={onBackfill} />
      </MemoryRouter>,
    );
    // Вчерашний день — свои оценки, а не оценки нового дня; бэкфилл есть (день не сегодняшний).
    expect(screen.queryByText('7,5'), tz).not.toBeNull();
    expect(screen.queryByText('2,5'), tz).toBeNull();
    expect(screen.queryByText(/Дополнить оценки|Заполнить этот день/), tz).not.toBeNull();
    unmount();
    vi.useRealTimers();
  };

  it('Москва, 00:30: вчерашний заполненный день показывает свои оценки', async () => {
    await inZone('Europe/Moscow', () => yesterdayShowsOwnRatings('Europe/Moscow'));
  });

  it('00:30 по местному времени в любой зоне: вчерашний день — вчера', async () => {
    await forEachTimeZoneAsync(yesterdayShowsOwnRatings);
  });

  it('вкладка, открытая за полночь: после 00:00 «сегодня» сменяется без перезагрузки', async () => {
    await forEachTimeZoneAsync(async (tz) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 7, 23, 50));
      const HistoryView = await freshHistoryView();
      // Новый элемент на каждый рендер: тот же объект React пропустил бы без перерисовки.
      const view = () => (
        <MemoryRouter>
          <HistoryView needs={NEEDS} history={HISTORY} currentRatings={CURRENT} />
        </MemoryRouter>
      );
      const { rerender, unmount } = render(view());
      // 7 ноября ещё сегодня — на экране текущие оценки дня.
      expect(screen.queryByText('2,5'), tz).not.toBeNull();
      vi.setSystemTime(new Date(2026, 10, 8, 0, 10));
      rerender(view());
      expect(screen.queryByText('7,5'), tz).not.toBeNull();
      expect(screen.queryByText('2,5'), tz).toBeNull();
      unmount();
      vi.useRealTimers();
    });
  });
});
