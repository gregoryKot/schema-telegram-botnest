// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PlanDraft } from '../guide/guidePlan';
import { PlanAddSheet } from './PlanAddSheet';

const h = vi.hoisted(() => ({
  createPlanItems: vi.fn(),
  getTherapyClients: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock('../../../api', () => ({ api: h, reportClientError: vi.fn() }));

const draft: PlanDraft = {
  rubric: 'cognitive', field: 'cognitive', label: 'Когнитивные (через понимание)',
  parts: ['Оценить риск [Арнтц, 5.1.1].', 'Потом — за и против.'],
  source: { kind: 'mode', id: 'bully_attack', field: 'cognitive' },
};
const show = (clientId?: number, onAdded?: () => void) =>
  render(<MemoryRouter><PlanAddSheet draft={draft} clientId={clientId} onAdded={onAdded} onClose={() => {}} /></MemoryRouter>);
const add = () => fireEvent.click(screen.getByRole('button', { name: 'Добавить в план' }));

beforeEach(() => {
  vi.clearAllMocks();
  h.createPlanItems.mockResolvedValue({ items: [] });
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
      clientIds: ['7'], rubric: 'cognitive', text: 'Оценить риск [Арнтц, 5.1.1]. Потом — за и против.', source: draft.source,
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
});
