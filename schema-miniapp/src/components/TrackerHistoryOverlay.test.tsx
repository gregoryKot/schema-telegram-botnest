// @vitest-environment jsdom
// TrackerHistoryOverlay — полноэкранная «История потребностей» (0% покрытия).
// HistoryView/TrackerOverlay уже покрыты своими тестами — мокаем их, здесь
// проверяем видимость/загрузку/чек-ин просроченного плана. Навигация шапки и
// backfill-оверлей — в TrackerHistoryOverlay.navigation.test.tsx (лимит
// ~300 строк/файл).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TrackerHistoryOverlay } from './TrackerHistoryOverlay';
import { useSheets } from '../hooks/useSheets';
import type { Need, DayHistory, PracticePlan } from '../api';
import { TODAY_DATE } from '../utils/todayConstants';

vi.mock('../api', () => ({
  api: { history: vi.fn() },
}));

vi.mock('./HistoryView', () => ({
  HistoryView: () => <div data-testid="history-view" />,
}));

vi.mock('./CheckInSheet', () => ({
  CheckInSheet: ({ plan }: { plan: PracticePlan }) => (
    <div data-testid="checkin-sheet">plan-{plan.id}</div>
  ),
}));

vi.mock('./TrackerOverlay', () => ({
  TrackerOverlay: () => <div data-testid="tracker-overlay" />,
}));

const need: Need = {
  id: 'attachment',
  emoji: '',
  title: 'Привязанность',
  chartLabel: 'Привязанность',
};

function makePlan(o: Partial<PracticePlan> = {}): PracticePlan {
  return {
    id: 1,
    needId: 'attachment',
    practiceText: 'Позвонить другу',
    scheduledDate: '2020-01-01',
    reminderUtcHour: null,
    done: null,
    ...o,
  };
}

function Harness(props: {
  historyLoading?: boolean;
  history?: DayHistory[];
  pendingPlans?: PracticePlan[];
  needs?: Need[];
  startOpen?: boolean;
}) {
  const sheets = useSheets();
  if (props.startOpen && !sheets.tracker) sheets.open('tracker');
  return (
    <TrackerHistoryOverlay
      sheets={sheets}
      safeTop={20}
      needs={props.needs ?? [need]}
      history={props.history ?? []}
      historyLoading={props.historyLoading ?? false}
      setHistory={() => {}}
      setHistoryLoading={() => {}}
      ratings={{}}
      childhoodRatings={{}}
      pendingPlans={props.pendingPlans ?? []}
      setPendingPlans={() => {}}
      historyDays={30}
      showYesterdaySheet={false}
      setShowYesterdaySheet={() => {}}
      backfillDate={null}
      setBackfillDate={() => {}}
    />
  );
}

afterEach(cleanup);

describe('TrackerHistoryOverlay — видимость', () => {
  it('sheets.tracker=false — не рендерит ничего', () => {
    const { container } = render(<Harness startOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('sheets.tracker=true — рендерит заголовок и HistoryView', () => {
    render(<Harness startOpen />);
    expect(screen.getByText('История потребностей')).toBeTruthy();
    expect(screen.getByTestId('history-view')).toBeTruthy();
  });
});

describe('TrackerHistoryOverlay — загрузка', () => {
  it('historyLoading=true — скелетон формы, не HistoryView', () => {
    const { container } = render(
      <Harness startOpen historyLoading history={[]} />,
    );
    expect(screen.queryByTestId('history-view')).toBeNull();
    expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(
      0,
    );
  });
});

describe('TrackerHistoryOverlay — чек-ин просроченного плана', () => {
  it('план с scheduledDate раньше сегодняшней — показывает CheckInSheet', () => {
    render(
      <Harness
        startOpen
        pendingPlans={[makePlan({ id: 42 })]}
        needs={[need]}
      />,
    );
    expect(screen.getByText('plan-42')).toBeTruthy();
  });

  it('план на сегодня/будущее — CheckInSheet не показывается', () => {
    render(
      <Harness
        startOpen
        pendingPlans={[makePlan({ id: 43, scheduledDate: TODAY_DATE })]}
        needs={[need]}
      />,
    );
    expect(screen.queryByTestId('checkin-sheet')).toBeNull();
  });

  it('план ссылается на неизвестную потребность — CheckInSheet не рендерится, не падает', () => {
    render(
      <Harness
        startOpen
        pendingPlans={[makePlan({ id: 44, needId: 'ghost_need' })]}
        needs={[need]}
      />,
    );
    expect(screen.queryByTestId('checkin-sheet')).toBeNull();
  });

  it('нет needs вообще — CheckInSheet не рендерится', () => {
    render(
      <Harness startOpen pendingPlans={[makePlan({ id: 45 })]} needs={[]} />,
    );
    expect(screen.queryByTestId('checkin-sheet')).toBeNull();
  });
});
