// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PlanDraft } from '../guide/guidePlan';
import { PlanAddSheet } from './PlanAddSheet';

const h = vi.hoisted(() => ({
  createPlanItems: vi.fn(),
  deletePlanItem: vi.fn(),
  getTherapyPlan: vi.fn(),
  getTherapyClients: vi.fn(),
  getTherapyPath: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock('../../../api', () => ({ api: h, reportClientError: vi.fn() }));

const draft: PlanDraft = {
  rubric: 'cognitive', field: 'cognitive', label: 'Когнитивные (через понимание)',
  parts: ['Оценить риск [Арнтц, 5.1.1].', 'Потом — за и против.'],
  sourceAddress: 'mode:bully_attack/cognitive',
};
const show = (clientId?: number, onAdded?: () => void) =>
  render(<MemoryRouter><PlanAddSheet draft={draft} clientId={clientId} onAdded={onAdded} onClose={() => {}} /></MemoryRouter>);
const add = () => fireEvent.click(screen.getByRole('button', { name: 'Добавить в план' }));

beforeEach(() => {
  vi.clearAllMocks();
  h.createPlanItems.mockResolvedValue({ items: [] });
  h.getTherapyPath.mockResolvedValue({ path: null });
  h.getTherapyPlan.mockResolvedValue([]);
  h.deletePlanItem.mockResolvedValue(undefined);
  h.getTherapyClients.mockResolvedValue([
    { telegramId: 11, name: 'Анна', clientAlias: null },
    { telegramId: 12, name: 'Борис', clientAlias: null },
  ]);
});

describe('PlanAddSheet — «В план» из справочника', () => {
  it('клиент известен: списка клиентов нет, рубрика уходит целиком со статьёй-источником', async () => {
    const onAdded = vi.fn();
    show(7, onAdded);
    expect(screen.queryByText('Кому в план')).toBeNull();
    expect(h.getTherapyClients).not.toHaveBeenCalled();
    add();
    await waitFor(() => expect(screen.getByText('Добавлено в план')).toBeTruthy());
    expect(h.createPlanItems).toHaveBeenCalledWith({
      clientIds: ['7'], rubric: 'cognitive', text: 'Оценить риск [Арнтц, 5.1.1]. Потом — за и против.', sourceAddress: draft.sourceAddress,
    });
    expect(h.trackEvent).toHaveBeenCalledWith('therapy_plan_item_added', { rubric: 'cognitive', fromGuide: true });
    expect(onAdded).toHaveBeenCalled();
  });

  it('снятая галочка убирает часть из текста; правка текста уходит как есть', async () => {
    show(7);
    fireEvent.click(screen.getByLabelText('Оценить риск [Арнтц, 5.1.1].'));
    const area = screen.getByLabelText('Текст пункта') as HTMLTextAreaElement;
    expect(area.value).toBe('Потом — за и против.');
    fireEvent.change(area, { target: { value: 'Разобрать за и против нападения' } });
    add();
    await waitFor(() => expect(h.createPlanItems).toHaveBeenCalledWith(expect.objectContaining({ text: 'Разобрать за и против нападения' })));
  });

  it('общий справочник: без выбранного клиента кнопка закрыта, выбранным — по пункту', async () => {
    show();
    await waitFor(() => expect(screen.getByLabelText('Анна')).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Добавить в план' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Анна'));
    fireEvent.click(screen.getByLabelText('Борис'));
    add();
    await waitFor(() => expect(h.createPlanItems).toHaveBeenCalledWith(expect.objectContaining({ clientIds: ['11', '12'] })));
  });

  it('отказ сервера: ошибка видна, лист остаётся с текстом', async () => {
    h.createPlanItems.mockRejectedValue(new Error('boom'));
    show(7);
    add();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Не удалось добавить в план'));
    expect(h.trackEvent).not.toHaveBeenCalled();
    expect(screen.queryByText('Добавлено в план')).toBeNull();
  });

  it('рубрика подобрана по тексту: её видно и можно сменить; у готовой рубрики выбора нет', async () => {
    show(7);
    expect(screen.queryByLabelText('Рубрика плана')).toBeNull();
    cleanup();
    render(<MemoryRouter><PlanAddSheet draft={{ ...draft, pickRubric: true }} clientId={7} onClose={() => {}} /></MemoryRouter>);
    const select = screen.getByLabelText('Рубрика плана') as HTMLSelectElement;
    expect(select.value).toBe('cognitive');
    fireEvent.change(select, { target: { value: 'behavioral' } });
    add();
    await waitFor(() => expect(h.createPlanItems).toHaveBeenCalledWith(expect.objectContaining({ rubric: 'behavioral' })));
    expect(await screen.findByText(/в рубрике «Поведенческие \(в жизни\)»/)).toBeTruthy();
  });

  it('такой пункт уже в плане: второй раз не добавляется, изменённый текст — добавляется', async () => {
    const text = 'Оценить риск [Арнтц, 5.1.1]. Потом — за и против.';
    h.getTherapyPlan.mockResolvedValue([{ id: 3, text, sourceAddress: draft.sourceAddress, source: null }]);
    show(7);
    expect(await screen.findByText(/уже стоит в плане/)).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Добавить в план' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Текст пункта'), { target: { value: 'Оценить риск вместе' } });
    expect(button.disabled).toBe(false);
  });

  it('общий справочник: пункт уходит только тем, у кого его ещё нет', async () => {
    const text = 'Оценить риск [Арнтц, 5.1.1]. Потом — за и против.';
    h.getTherapyPlan.mockImplementation((id: string) => Promise.resolve(id === '11' ? [{ id: 3, text, sourceAddress: draft.sourceAddress, source: null }] : []));
    show();
    fireEvent.click(await screen.findByLabelText('Анна'));
    fireEvent.click(screen.getByLabelText('Борис'));
    expect(await screen.findByText(/у 1 из 2/)).toBeTruthy();
    add();
    await waitFor(() => expect(h.createPlanItems).toHaveBeenCalledWith(expect.objectContaining({ clientIds: ['12'] })));
  });

  it('«Отменить» на итоге убирает добавленное и возвращает лист', async () => {
    h.createPlanItems.mockResolvedValue({ items: [{ id: 41 }, { id: 42 }] });
    const onAdded = vi.fn();
    show(7, onAdded);
    add();
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить в план' })).toBeTruthy());
    expect(h.deletePlanItem.mock.calls.map((c) => c[0])).toEqual([41, 42]);
    expect(onAdded).toHaveBeenCalledTimes(2);
  });

  it('отмена убрала не всё: ошибка видна, повтор убирает только оставшееся', async () => {
    h.createPlanItems.mockResolvedValue({ items: [{ id: 41 }, { id: 42 }] });
    h.deletePlanItem.mockImplementation((id: number) => (id === 42 ? Promise.reject(new Error('boom')) : Promise.resolve()));
    show(7);
    add();
    fireEvent.click(await screen.findByRole('button', { name: 'Отменить' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Не удалось отменить/);
    h.deletePlanItem.mockResolvedValue(undefined);
    h.deletePlanItem.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить в план' })).toBeTruthy());
    expect(h.deletePlanItem.mock.calls.map((c) => c[0])).toEqual([42]);
  });

  describe('фаза пути', () => {
    const phase = (id: number, position: number, name: string, over = {}) => ({
      id, position, name, goal: null, weeks: 4, templatePhaseId: null, startedAt: null, endedAt: null, criteriaDone: [], note: null, ...over,
    });
    const withPath = () => h.getTherapyPath.mockResolvedValue({ path: {
      id: 1, clientId: '7', startDate: '2026-11-02', templateId: null, createdAt: '', updatedAt: '',
      phases: [phase(5, 0, 'Оценка', { startedAt: '2026-11-02', endedAt: '2026-11-30' }), phase(6, 1, 'Связь', { startedAt: '2026-11-30' })],
    } });

    it('есть путь: предвыбрана текущая фаза и пункт уходит с ней; «Без фазы» снимает её', async () => {
      withPath();
      show(7);
      const select = (await screen.findByLabelText('Фаза пути')) as HTMLSelectElement;
      expect(select.value).toBe('6');
      add();
      await waitFor(() => expect(h.createPlanItems).toHaveBeenCalledWith(expect.objectContaining({ phaseId: 6 })));
    });

    it('«Без фазы»: phaseId не уходит', async () => {
      withPath();
      show(7);
      fireEvent.change(await screen.findByLabelText('Фаза пути'), { target: { value: '' } });
      add();
      await waitFor(() => expect(h.createPlanItems).toHaveBeenCalled());
      expect(h.createPlanItems.mock.calls[0][0]).not.toHaveProperty('phaseId');
    });

    it('пути нет или он не загрузился: выбора нет, пункт уходит как раньше', async () => {
      h.getTherapyPath.mockRejectedValue(new Error('boom'));
      show(7);
      add();
      await waitFor(() => expect(h.createPlanItems).toHaveBeenCalled());
      expect(screen.queryByLabelText('Фаза пути')).toBeNull();
      expect(h.createPlanItems.mock.calls[0][0]).not.toHaveProperty('phaseId');
    });
  });
});
