// @vitest-environment jsdom
// Шов вкладки «План работы»: ответ GET /api/therapy/plan/:id → пункты по рубрикам; пустой план — приглашение.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import type { TherapyClientSummary } from '../../../api';
import type { ClientDetail } from '../clientSheetTypes';

const h = vi.hoisted(() => ({
  getTherapyPlan: vi.fn(), createPlanItems: vi.fn(), updatePlanItem: vi.fn(), deletePlanItem: vi.fn(), trackEvent: vi.fn(),
}));
vi.mock('../../../api', () => ({ api: h, reportClientError: vi.fn() }));
vi.mock('../../../../../shared/src/therapy/conceptGraph/guideLoader', () => ({ useGuide: () => null }));

import { ClientPlanTab } from './ClientPlanTab';

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 1, clientId: '7', rubric: 'custom', text: 'пункт', status: 'planned', position: 0,
  source: null, taskId: null, createdAt: '2026-11-17T00:00:00.000Z', updatedAt: '2026-11-17T00:00:00.000Z', ...over,
});
const client = { telegramId: 7, name: 'Анна' } as unknown as TherapyClientSummary;
const patchConcept = vi.fn();
const detail = {
  localConcept: { goals: 'Меньше срывов' }, concept: null, conceptLoad: { failed: false, reloading: false },
  patchConcept, setClientTab: vi.fn(), saveStatus: 'idle', savedAt: null, retrySave: vi.fn(), conceptError: '',
  reloadConcept: vi.fn(), onTaskAssigned: vi.fn(),
} as unknown as ClientDetail;
const renderTab = () => render(<MemoryRouter><ClientPlanTab selectedClient={client} detail={detail} /></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); });

describe('ClientPlanTab', () => {
  it('пункты встают по рубрикам; тап по статусу шлёт следующий; цель правится полем концептуализации', async () => {
    h.getTherapyPlan.mockResolvedValue([
      item({ id: 1, rubric: 'custom', text: 'Свой пункт', position: 0 }),
      item({ id: 2, rubric: 'between', text: 'Дневник режима', position: 1, status: 'active' }),
      item({ id: 3, rubric: 'between', text: 'Письмо', position: 2, taskId: 40, status: 'done' }),
    ]);
    h.updatePlanItem.mockResolvedValue(item({ id: 1, rubric: 'custom', text: 'Свой пункт', status: 'active' }));
    renderTab();
    await screen.findByText('Дневник режима');
    expect(h.getTherapyPlan).toHaveBeenCalledWith(7);
    expect(screen.getAllByRole('heading', { level: 3 }).map((n) => n.textContent)).toEqual(['Между сессиями', 'Своё']);
    // «Дать заданием» — только у невыданного пункта «Между сессиями»; выданный помечен.
    expect(screen.getAllByText('Дать заданием')).toHaveLength(1);
    expect(screen.getByText('выдано заданием')).toBeTruthy();
    expect(screen.queryByText('В плане пока пусто')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Статус: намечено/ }));
    await waitFor(() => expect(h.updatePlanItem).toHaveBeenCalledWith(1, { status: 'active' }));
    await waitFor(() => expect(h.trackEvent).toHaveBeenCalledWith('therapy_plan_item_status', { status: 'active' }));

    fireEvent.change(screen.getByDisplayValue('Меньше срывов'), { target: { value: 'Меньше срывов и больше опоры' } });
    expect(patchConcept).toHaveBeenCalledWith({ goals: 'Меньше срывов и больше опоры' });
  });

  it('пустой план: приглашение и «+ Свой пункт» — новый пункт уходит в рубрику «Своё» и встаёт в список', async () => {
    h.getTherapyPlan.mockResolvedValue([]);
    h.createPlanItems.mockResolvedValue({ items: [item({ id: 5, text: 'Работа со стулом' })] });
    renderTab();
    await screen.findByText('В плане пока пусто');
    expect(screen.getByText('Открыть справочник')).toBeTruthy();
    fireEvent.click(screen.getByText('+ Свой пункт'));
    const save = screen.getByText('Сохранить') as HTMLButtonElement;
    expect(save.disabled).toBe(true); // пустой текст не сохраняется
    fireEvent.change(screen.getByLabelText('Текст пункта'), { target: { value: '  Работа со стулом ' } });
    fireEvent.click(save);
    await screen.findByText('Работа со стулом');
    expect(h.createPlanItems).toHaveBeenCalledWith({ clientIds: ['7'], rubric: 'custom', text: 'Работа со стулом' });
    expect(h.trackEvent).toHaveBeenCalledWith('therapy_plan_item_added', { rubric: 'custom', fromGuide: false });
    expect(screen.queryByText('В плане пока пусто')).toBeNull();
  });

  it('план не загрузился — не «пусто», а сообщение с «Повторить»', async () => {
    h.getTherapyPlan.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce([]);
    renderTab();
    fireEvent.click(await screen.findByText('Повторить'));
    await screen.findByText('В плане пока пусто');
    expect(h.getTherapyPlan).toHaveBeenCalledTimes(2);
  });
});
