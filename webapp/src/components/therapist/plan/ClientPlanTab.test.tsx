// @vitest-environment jsdom
// Шов вкладки «План работы»: ответ GET /api/therapy/plan/:id → пункты по рубрикам; пустой план — приглашение.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import type { TherapyClientSummary } from '../../../api';
import type { ClientDetail } from '../clientSheetTypes';

const h = vi.hoisted(() => ({
  getTherapyPlan: vi.fn(), createPlanItems: vi.fn(), updatePlanItem: vi.fn(), deletePlanItem: vi.fn(), reorderPlan: vi.fn(), trackEvent: vi.fn(),
  getGuideMarks: () => Promise.resolve({ marks: [] }),
}));
vi.mock('../../../api', () => ({ api: h, reportClientError: vi.fn() }));
vi.mock('../../../../../shared/src/therapy/conceptGraph/guideLoader', () => ({ useGuide: () => null }));
// Лист «Новое задание» — кнопкой: шов вкладки — что она делает с созданным заданием.
vi.mock('../../TaskCreateSheet', () => ({
  TaskCreateSheet: (p: { defaultText?: string; onCreated: (t: { id: number }) => void; onClose: () => void }) => (
    <button onClick={() => { p.onCreated({ id: 40 }); p.onClose(); }}>создать задание: {p.defaultText}</button>
  ),
}));

import { ClientPlanTab } from './ClientPlanTab';

const item = (over: Partial<PlanItem>): PlanItem => ({
  id: 1, clientId: '7', rubric: 'custom', text: 'пункт', status: 'planned', position: 0,
  sourceAddress: null, source: null, taskId: null, createdAt: '2026-11-17T00:00:00.000Z', updatedAt: '2026-11-17T00:00:00.000Z', ...over,
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

  it('«Дать заданием»: созданное задание запоминается в пункте; отметка не дошла — «Повторить» шлёт только её', async () => {
    const between = item({ id: 2, rubric: 'between', text: 'Дневник режима' });
    h.getTherapyPlan.mockResolvedValue([between]);
    h.updatePlanItem.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce({ ...between, taskId: 40 });
    renderTab();
    fireEvent.click(await screen.findByText('Дать заданием'));
    fireEvent.click(screen.getByText('создать задание: Дневник режима'));
    await screen.findByText('Задание создано, но не отметилось в плане');
    expect(h.updatePlanItem).toHaveBeenLastCalledWith(2, { taskId: 40 });
    expect(screen.queryByText('Дать заданием')).toBeNull(); // второе задание не создать
    fireEvent.click(screen.getByText('Повторить'));
    await screen.findByText('выдано заданием');
    expect(h.updatePlanItem).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Задание создано, но не отметилось в плане')).toBeNull();
    expect(detail.onTaskAssigned).toHaveBeenCalledTimes(1);
  });

  it('отказ смены статуса возвращает прежний статус и показывает ошибку', async () => {
    h.getTherapyPlan.mockResolvedValue([item({ id: 1, text: 'Свой пункт' })]);
    h.updatePlanItem.mockRejectedValue(new Error('net'));
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Статус: намечено/ }));
    await screen.findByText('Не удалось сохранить пункт');
    expect(screen.getByRole('button', { name: /Статус: намечено/ })).toBeTruthy();
    expect(h.trackEvent).not.toHaveBeenCalled();
  });

  it('удаление — через подтверждение; пункт уходит из списка', async () => {
    h.getTherapyPlan.mockResolvedValue([item({ id: 1, text: 'Свой пункт' }), item({ id: 2, text: 'Второй', position: 1 })]);
    h.deletePlanItem.mockResolvedValue(undefined);
    renderTab();
    await screen.findByText('Свой пункт');
    fireEvent.click(screen.getAllByRole('button', { name: 'Удалить пункт' })[0]);
    expect(h.deletePlanItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(screen.queryByText('Свой пункт')).toBeNull());
    expect(h.deletePlanItem).toHaveBeenCalledWith(1);
    expect(screen.getByText('Второй')).toBeTruthy();
  });

  it('«Опустить ниже» шлёт полный список id в новом порядке и переставляет пункты; один пункт в рубрике — без стрелок', async () => {
    const plan = [
      item({ id: 1, text: 'Первый', position: 0 }), item({ id: 2, text: 'Второй', position: 1 }),
      item({ id: 3, rubric: 'between', text: 'Дневник режима', position: 2 }),
    ];
    h.getTherapyPlan.mockResolvedValue(plan);
    h.reorderPlan.mockResolvedValue({ ok: true });
    renderTab();
    await screen.findByText('Первый');
    const texts = () => Array.from(document.querySelectorAll('.pl-text')).map((n) => n.textContent);
    const down = screen.getAllByRole('button', { name: 'Опустить ниже' }) as HTMLButtonElement[];
    expect(down).toHaveLength(2); // у одинокого пункта «Между сессиями» стрелок нет
    expect(down[1].disabled).toBe(true); // край рубрики
    fireEvent.click(down[0]);
    expect(texts()).toEqual(['Дневник режима', 'Второй', 'Первый']);
    await waitFor(() => expect(h.reorderPlan).toHaveBeenCalledWith(7, [3, 2, 1]));
  });

  it('отказ перестановки: ошибка видна, план перечитывается с сервера', async () => {
    h.getTherapyPlan.mockResolvedValue([item({ id: 1, text: 'Первый' }), item({ id: 2, text: 'Второй', position: 1 })]);
    h.reorderPlan.mockRejectedValue(new Error('Plan items mismatch'));
    renderTab();
    await screen.findByText('Первый');
    fireEvent.click(screen.getAllByRole('button', { name: 'Поднять выше' })[1]);
    await screen.findByText('Не удалось переставить пункт');
    expect(h.getTherapyPlan).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(Array.from(document.querySelectorAll('.pl-text')).map((n) => n.textContent)).toEqual(['Первый', 'Второй']));
  });
});
