// @vitest-environment jsdom
// HistoryView — контейнер вкладки «История» (0% покрытия, 479 строк).
// Дочерние блоки (date-picker/controls/wheel/need-row/insight/week-view/
// note/index-info/weekly-card/need-history sheets) покрыты своими тестами —
// мокаем. Здесь проверяем то, что принадлежит именно контейнеру: пустая
// история — честный экран (не нули/не крутилка), read-after-write заметки
// (открыл NoteSheet → закрыл → перечитал api.getNote заново, а не оставил
// старый текст в памяти), клэмп selectedIdx при укорочении истории.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { HistoryView } from './HistoryView';
import type { Need, DayHistory } from '../types';
import { TODAY_STR } from './historyView/constants';

vi.mock('./historyView/HistoryDatePicker', () => ({
  HistoryDatePicker: ({ onSelect }: { onSelect: (i: number) => void }) => (
    <button onClick={() => onSelect(1)}>date-picker-select-1</button>
  ),
}));
vi.mock('./historyView/HistoryControls', () => ({
  HistoryControls: ({
    onSubView,
  }: {
    onSubView: (v: 'day' | 'week') => void;
  }) => <button onClick={() => onSubView('week')}>controls-switch-week</button>,
}));
vi.mock('./historyView/WheelCard', () => ({
  WheelCard: ({ onClickCenter }: { onClickCenter: () => void }) => (
    <button onClick={onClickCenter}>wheel-card-center</button>
  ),
}));
vi.mock('./historyView/NeedRow', () => ({
  NeedRow: ({ need, onTap }: { need: Need; onTap: () => void }) => (
    <button onClick={onTap}>need-row-{need.id}</button>
  ),
}));
vi.mock('./historyView/InsightCard', () => ({
  InsightCard: () => <div data-testid="insight-card" />,
}));
vi.mock('./historyView/HistoryWeekView', () => ({
  HistoryWeekView: ({ onShowWeekCard }: { onShowWeekCard: () => void }) => (
    <button onClick={onShowWeekCard}>week-view-show-card</button>
  ),
}));
vi.mock('./NoteSheet', () => ({
  NoteSheet: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>note-sheet-close</button>
  ),
}));
vi.mock('./IndexInfoSheet', () => ({
  IndexInfoSheet: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>index-info-close</button>
  ),
}));
vi.mock('./WeeklyCardSheet', () => ({
  WeeklyCardSheet: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>weekly-card-close</button>
  ),
}));
vi.mock('./NeedHistorySheet', () => ({
  NeedHistorySheet: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>need-history-close</button>
  ),
}));

vi.mock('../api', () => ({
  api: { getNote: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as { getNote: ReturnType<typeof vi.fn> };

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockApi.getNote.mockResolvedValue({ text: null, tags: [] });
});

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '💙',
    title: 'Привязанность',
    chartLabel: 'Привязанность',
  },
  { id: 'autonomy', emoji: '🔑', title: 'Автономия', chartLabel: 'Автономия' },
];

function makeHistory(n: number): DayHistory[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(TODAY_STR);
    d.setDate(d.getDate() - i);
    return {
      date: d.toISOString().split('T')[0],
      ratings: { attachment: 6, autonomy: 5 },
    };
  });
}

describe('HistoryView — пустая история', () => {
  it('history=[] — честный пустой экран, не нули/крутилка', () => {
    render(<HistoryView needs={NEEDS} history={[]} currentRatings={{}} />);
    expect(screen.getByText('История пока пуста')).toBeTruthy();
  });

  it('onGoToToday задан — кнопка «Заполнить сегодня» зовёт его', () => {
    const onGoToToday = vi.fn();
    render(
      <HistoryView
        needs={NEEDS}
        history={[]}
        currentRatings={{}}
        onGoToToday={onGoToToday}
      />,
    );
    fireEvent.click(screen.getByText('Заполнить сегодня'));
    expect(onGoToToday).toHaveBeenCalled();
  });

  it('нет onGoToToday — кнопки нет', () => {
    render(<HistoryView needs={NEEDS} history={[]} currentRatings={{}} />);
    expect(screen.queryByText('Заполнить сегодня')).toBeNull();
  });
});

describe('HistoryView — read-after-write заметки', () => {
  it('при смене выбранного дня перечитывает api.getNote', async () => {
    render(
      <HistoryView
        needs={NEEDS}
        history={makeHistory(3)}
        currentRatings={{ attachment: 7 }}
      />,
    );
    await waitFor(() => expect(mockApi.getNote).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('date-picker-select-1'));
    await waitFor(() => expect(mockApi.getNote).toHaveBeenCalledTimes(2));
  });

  it('закрытие NoteSheet перечитывает заметку заново (не оставляет старый текст в памяти)', async () => {
    render(
      <HistoryView
        needs={NEEDS}
        history={makeHistory(3)}
        currentRatings={{ attachment: 7 }}
      />,
    );
    await waitFor(() => expect(mockApi.getNote).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Добавить заметку к этому дню'));
    fireEvent.click(screen.getByText('note-sheet-close'));
    await waitFor(() => expect(mockApi.getNote).toHaveBeenCalledTimes(2));
  });

  it('заметка с сервера отображается вместо плейсхолдера', async () => {
    mockApi.getNote.mockResolvedValue({
      text: 'Хороший день',
      tags: ['радость'],
    });
    render(
      <HistoryView
        needs={NEEDS}
        history={makeHistory(3)}
        currentRatings={{ attachment: 7 }}
      />,
    );
    expect(await screen.findByText('Хороший день')).toBeTruthy();
    expect(screen.getByText('радость')).toBeTruthy();
  });
});

describe('HistoryView — сетки/оверлеи', () => {
  it('клик по центру колеса открывает IndexInfoSheet, закрытие убирает', () => {
    render(
      <HistoryView
        needs={NEEDS}
        history={makeHistory(3)}
        currentRatings={{ attachment: 7 }}
      />,
    );
    fireEvent.click(screen.getByText('wheel-card-center'));
    expect(screen.getByText('index-info-close')).toBeTruthy();
    fireEvent.click(screen.getByText('index-info-close'));
    expect(screen.queryByText('index-info-close')).toBeNull();
  });

  it('клик по потребности открывает NeedHistorySheet', () => {
    render(
      <HistoryView
        needs={NEEDS}
        history={makeHistory(3)}
        currentRatings={{ attachment: 7 }}
      />,
    );
    fireEvent.click(screen.getByText('need-row-attachment'));
    expect(screen.getByText('need-history-close')).toBeTruthy();
  });

  it('переключение на week-вид рендерит HistoryWeekView, «показать карточку недели» открывает WeeklyCardSheet', () => {
    render(
      <HistoryView
        needs={NEEDS}
        history={makeHistory(8)}
        currentRatings={{ attachment: 7 }}
      />,
    );
    fireEvent.click(screen.getByText('controls-switch-week'));
    expect(screen.getByText('week-view-show-card')).toBeTruthy();
    fireEvent.click(screen.getByText('week-view-show-card'));
    expect(screen.getByText('weekly-card-close')).toBeTruthy();
  });
});

describe('HistoryView — бэкфилл прошлого дня', () => {
  it('onBackfill задан, выбран прошлый день — карточка бэкфилла видна и зовёт onBackfill с датой', () => {
    const onBackfill = vi.fn();
    const history = makeHistory(3);
    render(
      <HistoryView
        needs={NEEDS}
        history={history}
        currentRatings={{ attachment: 7 }}
        onBackfill={onBackfill}
      />,
    );
    fireEvent.click(screen.getByText('date-picker-select-1'));
    fireEvent.click(screen.getByText(/Заполнить этот день|Дополнить оценки/));
    expect(onBackfill).toHaveBeenCalledWith(history[1].date);
  });

  it('выбран сегодняшний день (idx=0) — карточки бэкфилла нет', () => {
    const onBackfill = vi.fn();
    render(
      <HistoryView
        needs={NEEDS}
        history={makeHistory(3)}
        currentRatings={{ attachment: 7 }}
        onBackfill={onBackfill}
      />,
    );
    expect(screen.queryByText('Заполнить этот день')).toBeNull();
  });
});

describe('HistoryView — ранняя подсказка (<3 дней истории)', () => {
  it('1 день истории — подсказка «Ещё 2 дня»', () => {
    render(
      <HistoryView
        needs={NEEDS}
        history={makeHistory(1)}
        currentRatings={{ attachment: 7 }}
      />,
    );
    expect(screen.getByText(/Ещё 2 дня/)).toBeTruthy();
  });

  it('3+ дня истории — подсказки нет', () => {
    render(
      <HistoryView
        needs={NEEDS}
        history={makeHistory(3)}
        currentRatings={{ attachment: 7 }}
      />,
    );
    expect(screen.queryByText(/паттерн начнёт/)).toBeNull();
  });
});
