// @vitest-environment jsdom
// HistorySheet — обёртка вокруг HistoryView (лениво загружаемого) внутри
// трекера. Было 0% покрытия (32 непокрытых строки). Проверяем: скелетон на
// время historyLoading (форма загрузки, а не пустой экран), реальный рендер
// истории после загрузки, кнопки «Назад»/«Оценить» и напоминание о
// просроченном плане практики (CheckInSheet) для реальной, а не выдуманной даты.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
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

// Холодный ленивый импорт HistoryView под нагрузкой дольше секунды waitFor —
// тест падал 1 из 20 (сведение g2). Модуль прогрет до тестов: Suspense ждёт
// только микротаск, а не трансформацию файла.
beforeAll(() => import('./HistoryView'));
afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

describe('HistorySheet', () => {
  // К4 дизайн-аудита 2026-08: оверлей размечен как диалог (useDialogA11y).
  it('размечен как диалог', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('пока historyLoading=true — скелетон по форме колеса потребностей, а не спиннер/пустота', () => {
    const { container } = renderSheet({ historyLoading: true });
    expect(screen.queryByText(/трекер сегодня/)).toBeNull();
    // Правило CLAUDE.md «скелетоны по форме, не спиннеры»: круглый силуэт
    // колеса потребностей + строки списка, не .spinner.
    expect(container.querySelectorAll('.skel').length).toBeGreaterThan(0);
    expect(container.querySelector('.spinner')).toBeNull();
  });

  it('после загрузки рендерит HistoryView (лениво, через Suspense)', async () => {
    renderSheet({ historyLoading: false, history: [] });
    expect(await screen.findByText(/трекер сегодня/, undefined, { timeout: 5000 })).toBeTruthy();
  });

  // Сбой ≠ пусто (2026-11, useTrackerHistory): отказ загрузки рисовал пустую
  // историю с призывом «Заполнить сегодня» — читалось как «записи пропали».
  it('historyFailed — «Не удалось загрузить историю», а не пустая история', async () => {
    renderSheet({ historyLoading: false, history: [], historyFailed: true });
    expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить историю');
    // текст идёт через glue: неразрывные пробелы — те же слова (shared/src/utils/typo.ts)
    expect(screen.getByRole('alert').textContent?.replace(/\u00a0/g, ' ')).toContain('оценки на месте');
    await act(async () => {});
    expect(screen.queryByText(/трекер сегодня/)).toBeNull();
  });

  it('«Оценить →» сначала закрывает лист, затем открывает трекер', async () => {
    // В одном такте go(-1) закрываемого и пуш открываемого запись трекера
    // терялась (Chromium, createBrowserRouter): трекер на экране, а «Назад»
    // уводил со страницы. Трекер открывается в onClose, после снятия записи.
    const log: string[] = [];
    HTMLElement.prototype.scrollIntoView = vi.fn();
    renderSheet({ onClose: () => log.push('close'), onOpenTracker: () => log.push('tracker'),
      history: [{ date: '2020-01-09', ratings: { attachment: 6 } }] });
    await waitFor(() => expect(screen.getByText('Привяз.')).toBeTruthy());
    fireEvent.click(screen.getByText('Оценить →'));
    expect(log).toEqual(['close', 'tracker']);
  });

  // Аудит 2026-11 (today-history-empty): «Оценить →» в шапке и «Заполнить сегодня» в листе —
  // две кнопки одного действия. В пустой истории остаётся одна, в листе.
  it('пустая история — без «Оценить →» в шапке, действие одно', async () => {
    renderSheet({ history: [] });
    await waitFor(() => expect(screen.getByText('Заполнить сегодня')).toBeTruthy());
    expect(screen.queryByText('Оценить →')).toBeNull();
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

  it('«Заполнить сегодня» (пустая история) сначала закрывает лист, затем открывает трекер', async () => {
    const log: string[] = [];
    renderSheet({ onClose: () => log.push('close'), onOpenTracker: () => log.push('tracker'), history: [] });
    await waitFor(() =>
      expect(screen.getByText('Заполнить сегодня')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('Заполнить сегодня'));
    expect(log).toEqual(['close', 'tracker']);
  });
});
