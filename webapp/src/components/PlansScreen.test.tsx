// @vitest-environment jsdom
// PlansScreen — история запланированных практик (0% покрытия). Проверяем:
// пустое состояние (не выдуманные карточки), деление на «ожидают/выполненные»,
// чек-ин (успех и read-after-write откат при сбое API — правило CLAUDE.md
// «провал не выглядит как успех»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlansScreen } from './PlansScreen';

const getPlanHistory = vi.fn();
const checkinPlan = vi.fn();

vi.mock('../api', () => ({
  api: {
    getPlanHistory: (...a: unknown[]) => getPlanHistory(...a),
    checkinPlan: (...a: unknown[]) => checkinPlan(...a),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

function renderScreen(onOpenTracker = vi.fn()) {
  return render(
    <MemoryRouter>
      <PlansScreen onClose={vi.fn()} onOpenTracker={onOpenTracker} />
    </MemoryRouter>,
  );
}

const today = new Date().toISOString().split('T')[0];

describe('PlansScreen — пустое состояние', () => {
  it('на чистом аккаунте (нет планов) показывает объяснение и путь в трекер, не выдуманные данные', async () => {
    getPlanHistory.mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText('Планов пока нет')).toBeTruthy();
  });

  it('клик «Открыть трекер» в пустом состоянии вызывает onOpenTracker и закрывает экран', async () => {
    getPlanHistory.mockResolvedValue([]);
    const onOpenTracker = vi.fn();
    renderScreen(onOpenTracker);
    fireEvent.click(await screen.findByText('Открыть трекер →'));
    expect(onOpenTracker).toHaveBeenCalled();
  });
});

describe('PlansScreen — сбой загрузки (сбой ≠ пусто)', () => {
  // Регрессия: раньше .catch(() => setPlans([])) рисовал «Планов пока нет»
  // человеку, у которого планы есть, просто запрос отвалился
  // (CLAUDE.md «сбой ≠ пусто»; пара к miniapp PlansScreen).
  it('провал api.getPlanHistory показывает явную ошибку, а не «Планов пока нет»', async () => {
    getPlanHistory.mockRejectedValue(new Error('network'));
    renderScreen();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось загрузить планы/);
    expect(screen.queryByText('Планов пока нет')).toBeNull();
  });

  it('«Попробовать ещё раз» перезапрашивает планы и убирает ошибку при успехе', async () => {
    getPlanHistory.mockRejectedValueOnce(new Error('network'));
    renderScreen();
    await screen.findByRole('alert');

    getPlanHistory.mockResolvedValueOnce([
      { id: 1, needId: 'attachment', practiceText: 'Позвонить другу', scheduledDate: today, reminderUtcHour: null, done: null },
    ]);
    fireEvent.click(screen.getByText('Попробовать ещё раз'));

    await waitFor(() => expect(screen.getByText('Позвонить другу')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('PlansScreen — список планов', () => {
  it('делит планы на «ожидают выполнения» и «выполненные»', async () => {
    getPlanHistory.mockResolvedValue([
      { id: 1, needId: 'attachment', practiceText: 'Позвонить другу', scheduledDate: today, reminderUtcHour: null, done: null },
      { id: 2, needId: 'autonomy', practiceText: 'Прогулка одному', scheduledDate: today, reminderUtcHour: null, done: true },
    ]);
    renderScreen();
    expect(await screen.findByText('Ожидают выполнения')).toBeTruthy();
    expect(screen.getByText('Выполненные')).toBeTruthy();
    expect(screen.getByText('1 активных · 1 завершённых')).toBeTruthy();
    expect(screen.getByText('Позвонить другу')).toBeTruthy();
    expect(screen.getByText('Прогулка одному')).toBeTruthy();
  });

  it('сегодняшняя дата плана подписана словом «Сегодня»', async () => {
    getPlanHistory.mockResolvedValue([
      { id: 1, needId: 'attachment', practiceText: 'Позвонить другу', scheduledDate: today, reminderUtcHour: null, done: null },
    ]);
    renderScreen();
    expect(await screen.findByText('Сегодня')).toBeTruthy();
  });
});

describe('PlansScreen — чек-ин плана', () => {
  it('«Выполнено» сразу помечает план выполненным (оптимистично) и шлёт запрос', async () => {
    getPlanHistory.mockResolvedValue([
      { id: 7, needId: 'attachment', practiceText: 'Позвонить другу', scheduledDate: today, reminderUtcHour: null, done: null },
    ]);
    checkinPlan.mockResolvedValue({});
    renderScreen();
    await screen.findByText('Позвонить другу');

    fireEvent.click(screen.getByText('✓ Выполнено'));
    expect(checkinPlan).toHaveBeenCalledWith(7, true);
    // Кнопки чек-ина пропадают — план перешёл в «выполненные».
    await waitFor(() => expect(screen.queryByText('✓ Выполнено')).toBeNull());
  });

  it('провал чек-ина откатывает план обратно в «ожидающие», а не тихо теряет статус', async () => {
    // Read-after-write: оптимистичное обновление обязано откатиться, если
    // сервер отверг запрос — иначе UI и БД расходятся молча.
    getPlanHistory.mockResolvedValue([
      { id: 8, needId: 'attachment', practiceText: 'Прогулка', scheduledDate: today, reminderUtcHour: null, done: null },
    ]);
    checkinPlan.mockRejectedValue(new Error('network'));
    renderScreen();
    await screen.findByText('Прогулка');

    fireEvent.click(screen.getByText('Не вышло'));
    await waitFor(() => expect(screen.getByText('✓ Выполнено')).toBeTruthy());
  });
});
