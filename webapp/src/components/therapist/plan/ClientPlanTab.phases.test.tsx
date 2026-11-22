// @vitest-environment jsdom
// Раскладка «По фазам»: перенос пункта между фазами (меню и перетаскивание), свой пункт внутри фазы.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PathPhase } from '../../../../../shared/src/therapy/path/pathModel';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import type { TherapyClientSummary } from '../../../api';

const phase = (over: Partial<PathPhase>): PathPhase => ({
  id: 1, position: 0, name: 'Оценка', goal: null, weeks: 6, templatePhaseId: null,
  startedAt: null, endedAt: null, criteriaDone: [], note: null, ...over,
});
const h = vi.hoisted(() => ({
  getTherapyPlan: vi.fn(), createPlanItems: vi.fn(), updatePlanItem: vi.fn(), trackEvent: vi.fn(),
  getGuideMarks: () => Promise.resolve({ marks: [] }),
  getTherapyPath: vi.fn(),
}));
vi.mock('../../../api', () => ({ api: h, reportClientError: vi.fn() }));
vi.mock('../../../../../shared/src/therapy/conceptGraph/guideLoader', () => ({ useGuide: () => null }));

import { ClientPlanTab } from './ClientPlanTab';
import { makeClientDetail } from '../clientDetail.test-helpers';

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 1, clientId: '7', rubric: 'custom', text: 'пункт', status: 'planned', position: 0,
  sourceAddress: null, source: null, taskId: null, phaseId: null, createdAt: '2026-11-17T00:00:00.000Z', updatedAt: '2026-11-17T00:00:00.000Z', ...over,
});
const client = { telegramId: 7, name: 'Анна' } as unknown as TherapyClientSummary;
const detail = makeClientDetail({ localConcept: { goals: '' }, patchConcept: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  h.getTherapyPath.mockResolvedValue({
    path: { id: 1, clientId: '7', startDate: '2026-11-02', templateId: null, createdAt: '', updatedAt: '',
      phases: [phase({ id: 1, name: 'Оценка' }), phase({ id: 2, name: 'Работа', position: 1 })] },
  });
  h.getTherapyPlan.mockResolvedValue([item({ id: 1, text: 'Дневник', phaseId: 1 })]);
});

async function open() {
  render(<MemoryRouter><ClientPlanTab selectedClient={client} detail={detail} /></MemoryRouter>);
  await screen.findByText('Дневник');
}

describe('ClientPlanTab: по фазам', () => {
  it('«В фазу…» открывает меню фаз и «Без фазы» с отметкой текущей; выбор шлёт phaseId', async () => {
    h.updatePlanItem.mockResolvedValue(item({ id: 1, text: 'Дневник', phaseId: 2 }));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Перенести пункт в фазу' }));
    expect(screen.getAllByRole('menuitemradio').map((n) => n.textContent)).toEqual(['✓Оценка', 'Работа', 'Без фазы']);
    expect(screen.getByRole('menuitemradio', { name: /Оценка/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Работа' }));
    await waitFor(() => expect(h.updatePlanItem).toHaveBeenCalledWith(1, { phaseId: 2 }));
  });

  it('Esc закрывает меню без запроса', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Перенести пункт в фазу' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(h.updatePlanItem).not.toHaveBeenCalled();
  });

  it('строку можно бросить на другую фазу', async () => {
    h.updatePlanItem.mockResolvedValue(item({ id: 1, text: 'Дневник', phaseId: 2 }));
    await open();
    const target = screen.getByRole('heading', { name: 'Работа' }).closest('article')!;
    const data: Record<string, string> = { 'application/plan-item': '1' };
    const dataTransfer = { types: Object.keys(data), getData: (t: string) => data[t], dropEffect: '' };
    fireEvent.dragOver(target, { dataTransfer });
    expect(target.className).toContain('is-drop');
    fireEvent.drop(target, { dataTransfer });
    await waitFor(() => expect(h.updatePlanItem).toHaveBeenCalledWith(1, { phaseId: 2 }));
  });

  it('«+ Свой пункт» в фазе: создаёт в рубрике «Своё» и тут же относит к фазе', async () => {
    h.createPlanItems.mockResolvedValue({ items: [item({ id: 9, text: 'Письмо себе' })] });
    h.updatePlanItem.mockResolvedValue(item({ id: 9, text: 'Письмо себе', phaseId: 2 }));
    await open();
    const card = screen.getByRole('heading', { name: 'Работа' }).closest('article')!;
    fireEvent.click(within(card).getByText('+ Свой пункт'));
    fireEvent.change(screen.getByLabelText('Текст пункта'), { target: { value: 'Письмо себе' } });
    fireEvent.click(screen.getByText('Сохранить'));
    await waitFor(() => expect(h.updatePlanItem).toHaveBeenCalledWith(9, { phaseId: 2 }));
    expect(h.createPlanItems).toHaveBeenCalledWith({ clientIds: ['7'], rubric: 'custom', text: 'Письмо себе' });
    expect(within(card).getByText('Письмо себе')).toBeTruthy();
  });

  it('статус меняется через меню пяти статусов', async () => {
    h.updatePlanItem.mockResolvedValue(item({ id: 1, text: 'Дневник', phaseId: 1, status: 'done' }));
    await open();
    fireEvent.click(screen.getByRole('button', { name: /^Статус:/ }));
    expect(screen.getAllByRole('menuitemradio').filter((n) => !/Оценка|Работа|Без фазы/.test(n.textContent ?? ''))).toHaveLength(5);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'сделано' }));
    await waitFor(() => expect(h.updatePlanItem).toHaveBeenCalledWith(1, { status: 'done' }));
  });

  it('строку можно бросить на «Без фазы»: phaseId null', async () => {
    h.updatePlanItem.mockResolvedValue(item({ id: 1, text: 'Дневник', phaseId: null }));
    await open();
    const target = document.querySelector('.ph-unphased')!;
    const data: Record<string, string> = { 'application/plan-item': '1' };
    fireEvent.drop(target, { dataTransfer: { types: Object.keys(data), getData: (t: string) => data[t], dropEffect: '' } });
    await waitFor(() => expect(h.updatePlanItem).toHaveBeenCalledWith(1, { phaseId: null }));
  });

  it('в «По каналам» строка не перетаскивается', async () => {
    await open();
    expect(document.querySelector('.pl-item')!.getAttribute('draggable')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'По каналам' }));
    expect(document.querySelector('.pl-item')!.getAttribute('draggable')).not.toBe('true');
  });
});
