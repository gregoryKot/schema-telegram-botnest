// @vitest-environment jsdom
// «Из плана» в итогах: отметка уходит наверх, быстрые статусы идут в PATCH пункта, пустой план — ничего.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PlanItem } from '../../../../shared/src/therapy/plan/planItem';

const h = vi.hoisted(() => ({
  getTherapyPlan: vi.fn(), getTherapyPath: vi.fn(), updatePlanItem: vi.fn(),
}));
vi.mock('../../api', () => ({ api: h, reportClientError: vi.fn() }));

import { SessionPlanBlock } from './SessionPlanBlock';

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 1, clientId: '7', rubric: 'custom', text: 'пункт', status: 'planned', position: 0, sourceAddress: null,
  source: null, taskId: null, phaseId: null, createdAt: '', updatedAt: '', ...over,
});
const phase = (id: number, name: string, startedAt: string | null, endedAt: string | null = null) =>
  ({ id, position: id, name, goal: null, weeks: 4, templatePhaseId: null, startedAt, endedAt, criteriaDone: [], note: null });

beforeEach(() => {
  vi.clearAllMocks();
  h.getTherapyPath.mockResolvedValue({ path: null });
});

describe('SessionPlanBlock', () => {
  it('нет кандидатов (пусто или всё закрыто) — ничего не рендерит', async () => {
    h.getTherapyPlan.mockResolvedValue([item({ status: 'done' })]);
    const { container } = render(<SessionPlanBlock clientId={7} selected={[]} onChange={vi.fn()} />);
    await waitFor(() => expect(h.getTherapyPlan).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('.skel')).toBeNull());
    expect(container.innerHTML).toBe('');
  });

  it('отметка «работали» уходит в onChange; у намеченного сразу «в работе»; текущая фаза помечена', async () => {
    h.getTherapyPlan.mockResolvedValue([item({ id: 1, text: 'Диалог на стульях', phaseId: 2 }), item({ id: 2, text: 'Дневник', phaseId: 1, status: 'active' })]);
    h.getTherapyPath.mockResolvedValue({ path: { phases: [phase(1, 'Оценка', '2026-10-01', '2026-10-30'), phase(2, 'Работа', '2026-11-01')] } });
    const onChange = vi.fn();
    const { rerender } = render(<SessionPlanBlock clientId={7} selected={[]} onChange={onChange} />);
    await screen.findByText('Работа · сейчас');
    fireEvent.click(screen.getByRole('checkbox', { name: /Диалог на стульях/ }));
    expect(onChange).toHaveBeenCalledWith([1]);
    rerender(<SessionPlanBlock clientId={7} selected={[1]} onChange={onChange} />);
    expect(screen.getByRole('checkbox', { name: /Диалог на стульях · в работе/ })).toBeTruthy();
  });

  it('«Сделано» зовёт updatePlanItem; повторный тап возвращает прежний статус; сбой — строкой', async () => {
    h.getTherapyPlan.mockResolvedValue([item({ id: 5, text: 'Рескриптинг', status: 'active' })]);
    h.updatePlanItem.mockResolvedValue(item({ id: 5 }));
    render(<SessionPlanBlock clientId={7} selected={[]} onChange={vi.fn()} />);
    const done = await screen.findByRole('button', { name: 'Сделано: Рескриптинг' });
    fireEvent.click(done);
    await waitFor(() => expect(h.updatePlanItem).toHaveBeenLastCalledWith(5, { status: 'done' }));
    await screen.findByRole('checkbox', { name: /Рескриптинг · сделано/ });
    fireEvent.click(screen.getByRole('button', { name: 'Сделано: Рескриптинг' }));
    await waitFor(() => expect(h.updatePlanItem).toHaveBeenLastCalledWith(5, { status: 'active' }));
    h.updatePlanItem.mockRejectedValue(new Error('x'));
    await screen.findByRole('checkbox', { name: /Рескриптинг · в работе/ });
    fireEvent.click(screen.getByRole('button', { name: 'Отложить: Рескриптинг' }));
    await screen.findByRole('alert');
  });
});
