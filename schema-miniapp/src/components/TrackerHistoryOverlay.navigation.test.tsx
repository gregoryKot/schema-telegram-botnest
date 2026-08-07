// @vitest-environment jsdom
// TrackerHistoryOverlay — навигация шапки и backfill-оверлей. Видимость/
// загрузка/чек-ин просроченного плана — в TrackerHistoryOverlay.test.tsx
// (лимит ~300 строк/файл). Использует реальный useSheets (не мок) — проверяет
// какие именно поля реестра меняются по каждому клику.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  renderHook,
  act,
} from '@testing-library/react';
import { TrackerHistoryOverlay } from './TrackerHistoryOverlay';
import { useSheets } from '../hooks/useSheets';
import { api } from '../api';
import type { Need } from '../api';

vi.mock('../api', () => ({
  api: { history: vi.fn() },
}));
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('./HistoryView', () => ({
  HistoryView: ({
    onGoToToday,
    onBackfill,
  }: {
    onGoToToday: () => void;
    onBackfill: (date: string) => void;
  }) => (
    <div data-testid="history-view">
      <button onClick={onGoToToday}>go-today</button>
      <button onClick={() => onBackfill('2026-01-01')}>backfill</button>
    </div>
  ),
}));

vi.mock('./CheckInSheet', () => ({
  CheckInSheet: () => null,
}));

vi.mock('./TrackerOverlay', () => ({
  TrackerOverlay: ({
    date,
    onDone,
  }: {
    date?: string;
    onDone?: () => void;
  }) => (
    <div data-testid="tracker-overlay">
      <span>date-{date}</span>
      <button onClick={onDone}>overlay-done</button>
    </div>
  ),
}));

const need: Need = {
  id: 'attachment',
  emoji: '',
  title: 'Привязанность',
  chartLabel: 'Привязанность',
};

function baseProps(sheets: ReturnType<typeof useSheets>) {
  return {
    sheets,
    safeTop: 0,
    needs: [need],
    history: [],
    historyLoading: false,
    setHistory: () => {},
    setHistoryLoading: () => {},
    ratings: {},
    childhoodRatings: {},
    pendingPlans: [],
    setPendingPlans: () => {},
    historyDays: 30,
    showYesterdaySheet: false,
    setShowYesterdaySheet: () => {},
    backfillDate: null,
    setBackfillDate: () => {},
  };
}

afterEach(cleanup);

describe('TrackerHistoryOverlay — навигация шапки', () => {
  it('«‹ Назад» закрывает трекер и переключает вкладку на «today»', () => {
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('tracker'));
    const { rerender } = render(
      <TrackerHistoryOverlay {...baseProps(result.current)} />,
    );
    fireEvent.click(screen.getByText('‹ Назад'));
    rerender(<TrackerHistoryOverlay {...baseProps(result.current)} />);
    expect(result.current.tracker).toBe(false);
    expect(result.current.trackerTab).toBe('today');
  });

  it('«Оценить →» закрывает историю и открывает trackerOverlay', () => {
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('tracker'));
    render(<TrackerHistoryOverlay {...baseProps(result.current)} />);
    fireEvent.click(screen.getByText('Оценить →'));
    expect(result.current.tracker).toBe(false);
    expect(result.current.trackerOverlay).toBe(true);
    expect(result.current.trackerNeedId).toBeNull();
  });

  it('HistoryView.onGoToToday закрывает tracker и открывает trackerOverlay', () => {
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('tracker'));
    render(<TrackerHistoryOverlay {...baseProps(result.current)} />);
    fireEvent.click(screen.getByText('go-today'));
    expect(result.current.tracker).toBe(false);
    expect(result.current.trackerOverlay).toBe(true);
  });
});

describe('TrackerHistoryOverlay — backfill overlay', () => {
  it('backfillDate задан — рендерит TrackerOverlay с этой датой', () => {
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('tracker'));
    render(
      <TrackerHistoryOverlay
        {...baseProps(result.current)}
        backfillDate="2026-02-02"
      />,
    );
    expect(screen.getByText('date-2026-02-02')).toBeTruthy();
  });

  it('HistoryView.onBackfill зовёт setBackfillDate с датой из истории', () => {
    const setBackfillDate = vi.fn();
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('tracker'));
    render(
      <TrackerHistoryOverlay
        {...baseProps(result.current)}
        setBackfillDate={setBackfillDate}
      />,
    );
    fireEvent.click(screen.getByText('backfill'));
    expect(setBackfillDate).toHaveBeenCalledWith('2026-01-01');
  });

  it('TrackerOverlay.onDone для backfill перечитывает историю и сбрасывает дату', async () => {
    mockApi.history.mockResolvedValue([]);
    const setBackfillDate = vi.fn();
    const setHistory = vi.fn();
    const setHistoryLoading = vi.fn();
    const { result } = renderHook(() => useSheets());
    act(() => result.current.open('tracker'));
    render(
      <TrackerHistoryOverlay
        {...baseProps(result.current)}
        setHistory={setHistory}
        setHistoryLoading={setHistoryLoading}
        backfillDate="2026-02-02"
        setBackfillDate={setBackfillDate}
      />,
    );
    fireEvent.click(screen.getByText('overlay-done'));
    expect(setBackfillDate).toHaveBeenCalledWith(null);
    expect(setHistoryLoading).toHaveBeenCalledWith(true);
    await waitFor(() => expect(mockApi.history).toHaveBeenCalledWith(30));
    await waitFor(() => expect(setHistory).toHaveBeenCalled());
    expect(setHistoryLoading).toHaveBeenCalledWith(false);
  });
});
