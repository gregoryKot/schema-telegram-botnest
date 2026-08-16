// @vitest-environment jsdom
// PlansScreen — история планов практики (0% покрытия): скелетон на загрузке,
// пустое состояние (не выдуманные данные), деление на «ожидают»/«завершённые»,
// и чек-ин прямо из карточки — оптимистичное обновление с откатом при сбое
// api.checkinPlan (иначе UI молча разъезжается с сервером).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { PlansScreen } from './PlansScreen';
import { api } from '../api';
import type { PracticePlan } from '../api';

vi.mock('../api', () => ({
  api: { getPlanHistory: vi.fn(), checkinPlan: vi.fn() },
}));
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makePlan(o: Partial<PracticePlan> = {}): PracticePlan {
  return {
    id: 1,
    needId: 'attachment',
    practiceText: 'Позвонить другу',
    scheduledDate: new Date().toISOString().split('T')[0],
    reminderUtcHour: null,
    done: null,
    ...o,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('PlansScreen — загрузка', () => {
  it('показывает скелетон-заглушку формы списка, пока данные не пришли', () => {
    mockApi.getPlanHistory.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PlansScreen onClose={() => {}} />);
    // SkeletonList рендерит aria-hidden плашки — не текст, не крутилку.
    expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText('Планов пока нет')).toBeNull();
  });
});

describe('PlansScreen — пустое состояние (чистый аккаунт)', () => {
  it('на пустом ответе показывает «Планов пока нет», а не выдуманные планы', async () => {
    mockApi.getPlanHistory.mockResolvedValue([]);
    render(<PlansScreen onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('Планов пока нет')).toBeTruthy(),
    );
  });

  it('кнопка «Открыть трекер →» закрывает экран и зовёт onOpenTracker', async () => {
    mockApi.getPlanHistory.mockResolvedValue([]);
    const onClose = vi.fn();
    const onOpenTracker = vi.fn();
    render(<PlansScreen onClose={onClose} onOpenTracker={onOpenTracker} />);
    await waitFor(() =>
      expect(screen.getByText('Планов пока нет')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('Открыть трекер →'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });

  it('без onOpenTracker кнопка перехода в трекер не рендерится', async () => {
    mockApi.getPlanHistory.mockResolvedValue([]);
    render(<PlansScreen onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('Планов пока нет')).toBeTruthy(),
    );
    expect(screen.queryByText('Открыть трекер →')).toBeNull();
  });
});

describe('PlansScreen — сбой загрузки (сбой ≠ пусто)', () => {
  it('провал api.getPlanHistory показывает явную ошибку, а не «Планов пока нет»', async () => {
    // Регрессия: раньше .catch(() => setPlans([])) рисовал «Планов пока
    // нет» человеку, у которого планы есть, просто запрос отвалился
    // (CLAUDE.md «сбой ≠ пусто»).
    mockApi.getPlanHistory.mockRejectedValue(new Error('network'));
    render(<PlansScreen onClose={() => {}} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось загрузить планы/);
    expect(screen.queryByText('Планов пока нет')).toBeNull();
  });

  it('«Попробовать ещё раз» перезапрашивает планы и убирает ошибку при успехе', async () => {
    mockApi.getPlanHistory.mockRejectedValueOnce(new Error('network'));
    render(<PlansScreen onClose={() => {}} />);
    await screen.findByRole('alert');

    mockApi.getPlanHistory.mockResolvedValueOnce([makePlan({ id: 1 })]);
    fireEvent.click(screen.getByText('Попробовать ещё раз'));

    await waitFor(() =>
      expect(screen.getByText('Позвонить другу')).toBeTruthy(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('PlansScreen — список планов', () => {
  it('делит на «Ожидают выполнения» и «Выполненные», считает счётчик в шапке', async () => {
    mockApi.getPlanHistory.mockResolvedValue([
      makePlan({ id: 1, done: null }),
      makePlan({ id: 2, done: true }),
      makePlan({ id: 3, done: false }),
    ]);
    render(<PlansScreen onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('Ожидают выполнения')).toBeTruthy(),
    );
    expect(screen.getByText('Выполненные')).toBeTruthy();
    expect(screen.getByText('1 активных · 2 завершённых')).toBeTruthy();
  });

  it('показывает реальное название потребности из needData, а не голый id', async () => {
    mockApi.getPlanHistory.mockResolvedValue([
      makePlan({ id: 1, needId: 'attachment' }),
    ]);
    render(<PlansScreen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Привязанность')).toBeTruthy());
  });

  it('неизвестный needId — не крашится, показывает сам id как запасной вариант', async () => {
    mockApi.getPlanHistory.mockResolvedValue([
      makePlan({ id: 1, needId: 'unknown_need' }),
    ]);
    render(<PlansScreen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('unknown_need')).toBeTruthy());
  });

  it('только незавершённые планы — заголовок «Выполненные» не рендерится', async () => {
    mockApi.getPlanHistory.mockResolvedValue([makePlan({ id: 1, done: null })]);
    render(<PlansScreen onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('Ожидают выполнения')).toBeTruthy(),
    );
    expect(screen.queryByText('Выполненные')).toBeNull();
  });

  it('клик по «Назад» зовёт onClose', async () => {
    mockApi.getPlanHistory.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<PlansScreen onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByText('Планов пока нет')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('‹'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PlansScreen — чек-ин из карточки', () => {
  it('«✓ Выполнено» оптимистично помечает план и зовёт checkinPlan(id, true)', async () => {
    mockApi.getPlanHistory.mockResolvedValue([makePlan({ id: 7, done: null })]);
    mockApi.checkinPlan.mockResolvedValue(undefined);
    render(<PlansScreen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('✓ Выполнено')).toBeTruthy());
    fireEvent.click(screen.getByText('✓ Выполнено'));
    expect(mockApi.checkinPlan).toHaveBeenCalledWith(7, true);
    // Оптимистично карточка сразу переезжает из "ожидают" (кнопки исчезают)
    await waitFor(() => expect(screen.queryByText('✓ Выполнено')).toBeNull());
  });

  it('«Не вышло» зовёт checkinPlan(id, false)', async () => {
    mockApi.getPlanHistory.mockResolvedValue([makePlan({ id: 8, done: null })]);
    mockApi.checkinPlan.mockResolvedValue(undefined);
    render(<PlansScreen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Не вышло')).toBeTruthy());
    fireEvent.click(screen.getByText('Не вышло'));
    expect(mockApi.checkinPlan).toHaveBeenCalledWith(8, false);
  });

  it('сбой checkinPlan откатывает оптимистичную отметку — план снова pending', async () => {
    mockApi.getPlanHistory.mockResolvedValue([makePlan({ id: 9, done: null })]);
    mockApi.checkinPlan.mockRejectedValue(new Error('network'));
    render(<PlansScreen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('✓ Выполнено')).toBeTruthy());
    fireEvent.click(screen.getByText('✓ Выполнено'));
    // После отката кнопки чек-ина снова на месте — план опять pending
    await waitFor(() => expect(screen.getByText('✓ Выполнено')).toBeTruthy());
    expect(screen.getByText('Не вышло')).toBeTruthy();
  });
});
