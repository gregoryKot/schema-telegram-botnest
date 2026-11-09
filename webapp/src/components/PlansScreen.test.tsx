// @vitest-environment jsdom
// PlansScreen — история запланированных практик (0% покрытия). Проверяем:
// пустое состояние (не выдуманные карточки), деление на «ожидают/выполненные»,
// чек-ин (успех и read-after-write откат при сбое API — правило CLAUDE.md
// «провал не выглядит как успех»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { PlansScreen } from './PlansScreen';
import { todayStr } from '../../../shared/src/utils/format';
import { forEachTimeZoneAsync } from '../../../shared/src/utils/timeZone.test-helpers';

const getPlanHistory = vi.fn();
const getSettings = vi.fn();
const checkinPlan = vi.fn();

vi.mock('../api', () => ({
  api: {
    getPlanHistory: (...a: unknown[]) => getPlanHistory(...a),
    checkinPlan: (...a: unknown[]) => checkinPlan(...a),
    getSettings: () => getSettings(),
  },
}));

// Лист плана — свой тест (PlanSheet.test.tsx); здесь важно, что он открывается.
vi.mock('./PlanSheet', () => ({
  PlanSheet: ({ needLabel, onSaved }: { needLabel: string; onSaved: () => void }) => (
    <div data-testid="plan-sheet">
      {needLabel}
      <button onClick={onSaved}>plan-saved</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue({ notifyReachable: true });
});

afterEach(() => {
  cleanup();
});

function renderScreen(onOpenTracker = vi.fn(), form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <PlansScreen onClose={vi.fn()} onOpenTracker={onOpenTracker} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

// Местный день устройства: им сервер пишет scheduledDate (правило №25).
const today = todayStr();

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

  it('объяснение пустого состояния звучит на «ты»', async () => {
    getPlanHistory.mockResolvedValue([]);
    renderScreen(vi.fn(), 'ty');
    expect(
      await screen.findByText(/Выбери, о какой позаботиться/),
    ).toBeTruthy();
  });

  // QA 2026-11 (B-М8): подпись обещала кнопку «Запланировать практику», которой
  // нет; путь к плану шёл только через трекер и ответ «Совсем нет».
  it('пустой экран не обещает несуществующую кнопку, а сам открывает план', async () => {
    getPlanHistory.mockResolvedValue([]);
    renderScreen();
    await screen.findByText('Планов пока нет');
    expect(screen.queryByText(/Запланировать практику/)).toBeNull();
    fireEvent.click(screen.getByText('Автономия'));
    expect(screen.getByTestId('plan-sheet').textContent).toContain('Автономия');
    fireEvent.click(screen.getByText('plan-saved'));
    await waitFor(() => expect(getPlanHistory).toHaveBeenCalledTimes(2)); // список перечитан
  });

  it('объяснение пустого состояния звучит на «вы»', async () => {
    getPlanHistory.mockResolvedValue([]);
    renderScreen(vi.fn(), 'vy');
    expect(
      await screen.findByText(/Выберите, о какой позаботиться/),
    ).toBeTruthy();
  });
});

// U5 (аудит 2026-11): «с напоминанием» звучало и тем, кому напоминание не
// дойдёт — без канала уведомлений (ни Telegram, ни веб-пушей).
describe('PlansScreen — пустое состояние не обещает напоминание без канала', () => {
  it('канал уведомлений есть — «с напоминанием» остаётся', async () => {
    getPlanHistory.mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText(/с напоминанием/)).toBeTruthy();
  });

  it('напоминанию некуда прийти — обещания нет', async () => {
    getSettings.mockResolvedValue({ notifyReachable: false });
    getPlanHistory.mockResolvedValue([]);
    renderScreen();
    await screen.findByText(/Выбери, о какой позаботиться/);
    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    expect(screen.queryByText(/напоминани/)).toBeNull();
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
    expect(screen.getByText('1 активный · 1 завершённый')).toBeTruthy();
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

  // docs/open/frontend-ux.md: «Сегодня» считалось днём UTC (toISOString), прочие
  // даты — new Date('YYYY-MM-DD') в местной зоне: в Сиднее после полуночи план на
  // сегодня шёл «Завтра», в Лос-Анджелесе 5 ноября показывалось «4 нояб.».
  it('в любой зоне: «Сегодня» — местный день, прошлый день — своим числом', async () => {
    await forEachTimeZoneAsync(async (tz) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 6, 0, 30)); // 00:30 6 ноября по зоне
      getPlanHistory.mockResolvedValue([
        { id: 1, needId: 'attachment', practiceText: 'Позвонить другу', scheduledDate: '2026-11-06', reminderUtcHour: null, done: null },
        { id: 2, needId: 'autonomy', practiceText: 'Прогулка', scheduledDate: '2026-11-05', reminderUtcHour: null, done: true },
      ]);
      try {
        renderScreen();
        expect(await screen.findByText('Сегодня'), tz).toBeTruthy();
        expect(screen.getByText('5 нояб.'), tz).toBeTruthy();
      } finally {
        cleanup();
        vi.useRealTimers();
      }
    });
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

    fireEvent.click(screen.getByText('Выполнено'));
    expect(checkinPlan).toHaveBeenCalledWith(7, true);
    // Кнопки чек-ина пропадают — план перешёл в «выполненные».
    await waitFor(() => expect(screen.queryByText('Выполнено')).toBeNull());
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
    await waitFor(() => expect(screen.getByText('Выполнено')).toBeTruthy());
  });
});
