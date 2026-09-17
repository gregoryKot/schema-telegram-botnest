// @vitest-environment jsdom
// HistorySheet — цепочка «дозаполнить прошлый день» (backfill), включая
// fillHistoryGaps: read-after-write по правилу CLAUDE.md (сохранил через
// TrackerOverlay → история обязана перезагрузиться и подтянуть дырки между
// сохранённой датой и сегодня, а не просто вставить одну точку). HistoryView
// и TrackerOverlay мокнуты локально (в этом файле), чтобы тестировать
// именно проводку HistorySheet, а не их собственные экраны — те покрыты
// своими тестами (HistorySheet.test.tsx, TrackerOverlay.test.tsx).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HistorySheet } from './HistorySheet';
import type { Need } from '../api';

vi.mock('../api', () => ({
  api: {
    getNote: vi.fn().mockResolvedValue({ text: null, tags: [] }),
    history: vi.fn(),
    checkinPlan: vi.fn().mockResolvedValue({}),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('./HistoryView', () => ({
  HistoryView: ({ onBackfill }: { onBackfill?: (date: string) => void }) => (
    <button onClick={() => onBackfill?.('2020-01-09')}>открыть-бэкафилл-09</button>
  ),
}));

vi.mock('./TrackerOverlay', () => ({
  TrackerOverlay: ({
    date,
    onDone,
    onClose,
  }: {
    date?: string;
    onDone: () => void;
    onClose: () => void;
  }) => (
    <div>
      <span>бэкафилл-трекер:{date}</span>
      <button onClick={onDone}>завершить-бэкафилл</button>
      <button onClick={onClose}>закрыть-бэкафилл</button>
    </div>
  ),
}));

const NEEDS: Need[] = [
  { id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привяз.' },
];

function renderSheet(props: Partial<Parameters<typeof HistorySheet>[0]> = {}) {
  const onHistoryRefreshed = vi.fn();
  const utils = render(
    <MemoryRouter>
      <HistorySheet
        needs={NEEDS}
        history={[]}
        historyLoading={false}
        ratings={{}}
        childhoodRatings={{}}
        pendingPlans={[]}
        todayDate="2020-01-10"
        historyDays={30}
        onClose={vi.fn()}
        onOpenTracker={vi.fn()}
        onOpenSchemas={vi.fn()}
        onOpenChildhoodWheel={vi.fn()}
        onDismissPlan={vi.fn()}
        onHistoryRefreshed={onHistoryRefreshed}
        {...props}
      />
    </MemoryRouter>,
  );
  return { ...utils, onHistoryRefreshed };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Только Date подделан (fillHistoryGaps читает `new Date()` как «сегодня»);
  // setTimeout/микротаски остаются реальными, иначе findByText/Suspense
  // зависают — RTL ждёт их через реальные таймеры.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2020-01-10T12:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('HistorySheet — открытие/закрытие бэкафилла прошлой даты', () => {
  it('клик в HistoryView открывает TrackerOverlay на выбранной дате', async () => {
    renderSheet();
    fireEvent.click(await screen.findByText('открыть-бэкафилл-09'));
    expect(await screen.findByText('бэкафилл-трекер:2020-01-09')).toBeTruthy();
  });

  it('закрытие TrackerOverlay без сохранения убирает его и не трогает историю', async () => {
    const { onHistoryRefreshed } = renderSheet();
    fireEvent.click(await screen.findByText('открыть-бэкафилл-09'));
    fireEvent.click(await screen.findByText('закрыть-бэкафилл'));
    expect(screen.queryByText(/бэкафилл-трекер/)).toBeNull();
    expect(mockApi.history).not.toHaveBeenCalled();
    expect(onHistoryRefreshed).not.toHaveBeenCalled();
  });
});

describe('HistorySheet — fillHistoryGaps после сохранения (read-after-write)', () => {
  it('дырка между сегодня и старой оценкой заполняется нулевыми днями, а не пропадает', async () => {
    mockApi.history.mockResolvedValue([
      { date: '2020-01-10', ratings: { attachment: 5 } },
      { date: '2020-01-08', ratings: { attachment: 2 } },
    ]);
    const { onHistoryRefreshed } = renderSheet();
    fireEvent.click(await screen.findByText('открыть-бэкафилл-09'));
    const finishBtn = await screen.findByText('завершить-бэкафилл');
    await act(async () => {
      fireEvent.click(finishBtn);
    });

    expect(mockApi.history).toHaveBeenCalledWith(30);
    expect(onHistoryRefreshed).toHaveBeenCalledWith([
      { date: '2020-01-10', ratings: { attachment: 5 } },
      { date: '2020-01-09', ratings: {} },
      { date: '2020-01-08', ratings: { attachment: 2 } },
    ]);
    // TrackerOverlay закрылся после завершения.
    expect(screen.queryByText(/бэкафилл-трекер/)).toBeNull();
  });

  it('ошибка перезагрузки истории проглатывается молча — не роняет экран', async () => {
    mockApi.history.mockRejectedValue(new Error('network'));
    const { onHistoryRefreshed } = renderSheet();
    fireEvent.click(await screen.findByText('открыть-бэкафилл-09'));
    const finishBtn = await screen.findByText('завершить-бэкафилл');
    await act(async () => {
      fireEvent.click(finishBtn);
    });

    expect(onHistoryRefreshed).not.toHaveBeenCalled();
    // Экран остаётся смонтированным (не упал), TrackerOverlay всё равно закрылся.
    expect(screen.queryByText(/бэкафилл-трекер/)).toBeNull();
    expect(screen.getByText('Оценить →')).toBeTruthy();
  });

  it('история без дырки (пустая, только сегодня) не добавляет лишних дней', async () => {
    mockApi.history.mockResolvedValue([{ date: '2020-01-10', ratings: { attachment: 5 } }]);
    const { onHistoryRefreshed } = renderSheet();
    fireEvent.click(await screen.findByText('открыть-бэкафилл-09'));
    const finishBtn = await screen.findByText('завершить-бэкафилл');
    await act(async () => {
      fireEvent.click(finishBtn);
    });

    expect(onHistoryRefreshed).toHaveBeenCalledWith([{ date: '2020-01-10', ratings: { attachment: 5 } }]);
  });
});
