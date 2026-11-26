// @vitest-environment jsdom
// План из общего поиска: «История планов» грузит период до его дня (обычный вход — 30 дней),
// строка плана прокручена в вид и обведена. Раньше план старше месяца находился, а в списке его не было.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { PlansScreen } from './PlansScreen';
import { planFocusOf, planHistoryDays, type PlanFocus } from './plans/planFocus';
import { shiftCalendarDay } from '../../../shared/src/utils/calendarDate';
import { todayStr } from '../../../shared/src/utils/format';

const getPlanHistory = vi.fn();
vi.mock('../api', () => ({
  api: {
    getPlanHistory: (...a: unknown[]) => getPlanHistory(...a),
    checkinPlan: vi.fn(),
    getSettings: () => Promise.resolve({ notifyReachable: true }),
  },
}));

const today = todayStr();
const plan = (id: number, practiceText: string, scheduledDate: string) =>
  ({ id, needId: 'attachment', practiceText, scheduledDate, reminderUtcHour: null, done: true });

function renderScreen(focus?: PlanFocus) {
  render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
      <MemoryRouter><PlansScreen onClose={vi.fn()} focus={focus} /></MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('«История планов» из общего поиска', () => {
  it('план старше месяца: период покрывает его день, строка в виду и обведена, соседняя — нет', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const old = shiftCalendarDay(today, -100);
    getPlanHistory.mockResolvedValue([plan(1, 'Свежий план', today), plan(7, 'Позвать друга на чай', old)]);
    renderScreen({ id: 7, date: old });
    const row = (await screen.findByText('Позвать друга на чай')).closest('[data-spot]')!;
    expect(getPlanHistory).toHaveBeenCalledWith(102);
    await waitFor(() => expect(row.hasAttribute('data-spotlit')).toBe(true));
    expect(scroll.mock.contexts).toEqual([row]);
    expect(screen.getByText('Свежий план').closest('[data-spot]')!.hasAttribute('data-spotlit')).toBe(false);
  });

  it('обычный вход грузит 30 дней и ничего не подсвечивает', async () => {
    getPlanHistory.mockResolvedValue([plan(1, 'Свежий план', today)]);
    renderScreen();
    await screen.findByText('Свежий план');
    expect(getPlanHistory).toHaveBeenCalledWith(30);
    expect(document.querySelector('[data-spotlit]')).toBeNull();
  });

  it('период: не меньше 30 дней и не больше потолка ручки; цель чужой формы отбрасывается', () => {
    expect(planHistoryDays({ id: 1, date: shiftCalendarDay(today, -3) }, today)).toBe(30);
    expect(planHistoryDays({ id: 1, date: shiftCalendarDay(today, -364) }, today)).toBe(365);
    expect(planHistoryDays({ id: 1, date: shiftCalendarDay(today, 5) }, today)).toBe(30);
    expect(planFocusOf({ id: 1, date: '2026-03-01' })).toEqual({ id: 1, date: '2026-03-01' });
    expect(planFocusOf({ id: '1', date: '2026-03-01' })).toBeNull();
    expect(planFocusOf({ id: 1, date: '01.03.2026' })).toBeNull();
  });
});
