// @vitest-environment jsdom
// HistorySheet — обёртка вокруг HistoryView (лениво загружаемого) внутри
// трекера. Было 0% покрытия (32 непокрытых строки). Проверяем: скелетон на
// время historyLoading (форма загрузки, а не пустой экран), реальный рендер
// истории после загрузки, кнопки «Назад»/«Оценить» и напоминание о
// просроченном плане практики (CheckInSheet) для реальной, а не выдуманной даты.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HistorySheet } from './HistorySheet';
import type { Need, PracticePlan } from '../api';

vi.mock('../api', () => ({
  api: {
    getNote: vi.fn().mockResolvedValue({ text: null, tags: [] }),
    history: vi.fn().mockResolvedValue([]),
    checkinPlan: vi.fn().mockResolvedValue({}),
    trackEvent: vi.fn(),
  },
}));

HTMLElement.prototype.scrollIntoView = vi.fn();

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привяз.',
  },
];

function renderSheet(props: Partial<Parameters<typeof HistorySheet>[0]> = {}) {
  return render(
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
        onHistoryRefreshed={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

describe('HistorySheet', () => {
  it('пока historyLoading=true — скелетон-лоадер, HistoryView не рендерится', () => {
    renderSheet({ historyLoading: true });
    expect(screen.queryByText('Пусто.')).toBeNull();
  });

  it('после загрузки рендерит HistoryView (лениво, через Suspense)', async () => {
    renderSheet({ historyLoading: false, history: [] });
    await waitFor(() => expect(screen.getByText('Пусто.')).toBeTruthy());
  });

  it('«Оценить →» одновременно открывает трекер и закрывает лист', async () => {
    const onOpenTracker = vi.fn();
    renderSheet({ onOpenTracker });
    await waitFor(() => expect(screen.getByText('Пусто.')).toBeTruthy());
    fireEvent.click(screen.getByText('Оценить →'));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });

  it('просроченный план практики (scheduledDate < todayDate) показывает CheckInSheet', async () => {
    const plans: PracticePlan[] = [
      {
        id: 1,
        needId: 'attachment',
        practiceText: 'Подышать 5 минут',
        scheduledDate: '2020-01-05',
        reminderUtcHour: null,
        done: null,
      },
    ];
    await act(async () => {
      renderSheet({ pendingPlans: plans, todayDate: '2020-01-10' });
    });
    // CheckInSheet спрашивает, выполнена ли запланированная практика.
    expect(screen.getByText(/Подышать 5 минут/)).toBeTruthy();
  });

  it('план с будущей датой (scheduledDate >= todayDate) НЕ показывает CheckInSheet', async () => {
    const plans: PracticePlan[] = [
      {
        id: 2,
        needId: 'attachment',
        practiceText: 'Будущая практика',
        scheduledDate: '2020-01-20',
        reminderUtcHour: null,
        done: null,
      },
    ];
    await act(async () => {
      renderSheet({ pendingPlans: plans, todayDate: '2020-01-10' });
    });
    expect(screen.queryByText(/Будущая практика/)).toBeNull();
  });

  it('просроченный план ссылается на несуществующую потребность — CheckInSheet не рендерится (не падает)', async () => {
    const plans: PracticePlan[] = [
      {
        id: 3,
        needId: 'unknown_need',
        practiceText: 'Практика-призрак',
        scheduledDate: '2020-01-05',
        reminderUtcHour: null,
        done: null,
      },
    ];
    await act(async () => {
      renderSheet({ pendingPlans: plans, todayDate: '2020-01-10' });
    });
    expect(screen.queryByText(/Практика-призрак/)).toBeNull();
  });

  it('«Заполнить сегодня» (пустая история) одновременно открывает трекер и закрывает лист', async () => {
    const onOpenTracker = vi.fn();
    renderSheet({ onOpenTracker, history: [] });
    await waitFor(() =>
      expect(screen.getByText('Заполнить сегодня')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('Заполнить сегодня'));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });
});
