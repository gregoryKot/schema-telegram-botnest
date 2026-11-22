// @vitest-environment jsdom
// Шов раскладки «По фазам»: ответ GET /api/therapy/path → пустое состояние или лента; правки уходят ручками пути.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PathPhase, TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import { phaseDraftsFromTemplate } from '../../../../../../shared/src/therapy/path/pathPlan';
import { pathTemplate } from '../../../../../../shared/src/therapy/path/templates';
import { shiftCalendarDay } from '../../../../../../shared/src/utils/calendarDate';
import { todayStr } from '../../../../../../shared/src/utils/format';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';

const h = vi.hoisted(() => ({
  getTherapyPath: vi.fn(), createTherapyPath: vi.fn(), updatePathPhase: vi.fn(), advancePathPhase: vi.fn(),
  addPathPhase: vi.fn(), setTherapyPathStart: vi.fn(), deletePathPhase: vi.fn(), reorderPathPhases: vi.fn(),
}));
vi.mock('../../../../api', () => ({ api: h, reportClientError: vi.fn() }));

import type { PlanItems } from '../usePlanItems';
import { PathLayout } from './PathLayout';
import { usePath } from './usePath';

const phase = (over: Partial<PathPhase>): PathPhase => ({
  id: 1, position: 0, name: 'Оценка и концептуализация', goal: 'Понять схемы', weeks: 6, templatePhaseId: 'assessment',
  startedAt: null, endedAt: null, criteriaDone: [], note: null, ...over,
});
const path = (phases: PathPhase[]): TherapyPath => ({
  id: 1, clientId: '7', startDate: '2026-11-02', templateId: 'general', phases, createdAt: '', updatedAt: '',
});
const items: PlanItem[] = [];

function Harness() {
  const state = usePath(7);
  return <PathLayout path={state} plan={{ busyId: null } as PlanItems} items={items} renderRow={(i) => <div key={i.id}>{i.text}</div>} />;
}
const renderLayout = () => render(<MemoryRouter><Harness /></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); });

describe('PathLayout', () => {
  it('пути нет: объяснение и «Собрать путь»; лист собирает путь из общего шаблона с сегодняшним стартом', async () => {
    h.getTherapyPath.mockResolvedValue({ path: null });
    const created = path([phase({ id: 5 })]);
    h.createTherapyPath.mockResolvedValue({ path: created });
    renderLayout();
    fireEvent.click(await screen.findByRole('button', { name: 'Собрать путь' }));
    expect((screen.getByDisplayValue(todayStr()) as HTMLInputElement).type).toBe('date');
    fireEvent.click(screen.getByRole('button', { name: 'Собрать' }));
    const general = pathTemplate((ty) => ty, 'general')!;
    await waitFor(() => expect(h.createTherapyPath).toHaveBeenCalledWith(7, {
      startDate: todayStr(), templateId: 'general', phases: phaseDraftsFromTemplate(general),
    }));
    await screen.findByRole('heading', { name: 'Оценка и концептуализация' });
  });

  it('«Пустой путь» уходит без фаз и без шаблона', async () => {
    h.getTherapyPath.mockResolvedValue({ path: null });
    h.createTherapyPath.mockResolvedValue({ path: path([]) });
    renderLayout();
    fireEvent.click(await screen.findByRole('button', { name: 'Собрать путь' }));
    fireEvent.click(screen.getByRole('radio', { name: /Пустой путь/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Собрать' }));
    await waitFor(() => expect(h.createTherapyPath).toHaveBeenCalledWith(7, expect.objectContaining({ templateId: null, phases: [] })));
  });

  it('текущая фаза: отметка критерия шлёт criteriaDone, «Завершить и перейти» — advance сегодняшним днём', async () => {
    const current = path([phase({ id: 1, startedAt: '2026-11-02' }), phase({ id: 2, position: 1, name: 'Начало работы', templatePhaseId: null })]);
    h.getTherapyPath.mockResolvedValue({ path: current });
    h.updatePathPhase.mockResolvedValue({ path: current });
    h.advancePathPhase.mockResolvedValue({ path: current });
    renderLayout();
    await screen.findByText('мы здесь');
    expect(screen.getByText('отмечено 0 из 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Клиент согласен на курс' }));
    await waitFor(() => expect(h.updatePathPhase).toHaveBeenCalledWith(1, { criteriaDone: [1] }));
    fireEvent.click(screen.getByRole('button', { name: 'Завершить и перейти к следующей' }));
    await waitFor(() => expect(h.advancePathPhase).toHaveBeenCalledWith(1, todayStr()));
  });

  it('знак и бумага стадии — у фазы шаблона, своя фаза терапевта остаётся без них', async () => {
    h.getTherapyPath.mockResolvedValue({ path: path([phase({ id: 1 }), phase({ id: 2, position: 1, name: 'Начало работы', templatePhaseId: null })]) });
    const { container } = renderLayout();
    await screen.findByRole('heading', { name: 'Начало работы' });
    const cards = [...container.querySelectorAll('.ph-card')];
    expect(cards.map((c) => c.querySelector('.ph-sign svg') !== null)).toEqual([true, false]);
    expect((cards[0].querySelector('.ph-sign') as HTMLElement).style.getPropertyValue('--h')).toBe('310');
  });

  it('текущей нет — «Начать фазу» ставит startedAt; путь не загрузился — «Повторить»', async () => {
    const idle = path([phase({ id: 1 })]);
    h.getTherapyPath.mockRejectedValueOnce(new Error('net')).mockResolvedValue({ path: idle });
    h.updatePathPhase.mockResolvedValue({ path: idle });
    renderLayout();
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Начать фазу' }));
    await waitFor(() => expect(h.updatePathPhase).toHaveBeenCalledWith(1, { startedAt: todayStr() }));
  });

  describe('правка фаз', () => {
    const two = path([phase({ id: 1, startedAt: '2026-11-02' }), phase({ id: 2, position: 1, name: 'Начало работы', goal: null, weeks: 8, templatePhaseId: null })]);
    beforeEach(() => { h.getTherapyPath.mockResolvedValue({ path: two }); });

    it('карандаш — форма фазы; новый срок уходит PATCH-ем вместе с названием и целью', async () => {
      h.updatePathPhase.mockResolvedValue({ path: two });
      renderLayout();
      fireEvent.click(await screen.findByRole('button', { name: 'Изменить фазу «Оценка и концептуализация»' }));
      fireEvent.change(screen.getByLabelText('Срок, недель'), { target: { value: '9' } });
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await waitFor(() => expect(h.updatePathPhase).toHaveBeenCalledWith(1, { name: 'Оценка и концептуализация', goal: 'Понять схемы', weeks: 9 }));
    });

    it('«Фазу ниже» шлёт весь порядок; удаление — через подтверждение', async () => {
      h.reorderPathPhases.mockResolvedValue({ path: two });
      h.deletePathPhase.mockResolvedValue({ path: path([two.phases[1]]) });
      renderLayout();
      fireEvent.click((await screen.findAllByRole('button', { name: 'Фазу ниже' }))[0]);
      await waitFor(() => expect(h.reorderPathPhases).toHaveBeenCalledWith(7, [2, 1]));
      fireEvent.click(screen.getByRole('button', { name: 'Удалить фазу «Оценка и концептуализация»' }));
      expect(h.deletePathPhase).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
      await waitFor(() => expect(h.deletePathPhase).toHaveBeenCalledWith(7, 1));
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Оценка и концептуализация' })).toBeNull());
    });

    it('«Добавить фазу» — своя фаза без шаблона', async () => {
      h.addPathPhase.mockResolvedValue({ path: two });
      renderLayout();
      fireEvent.click(await screen.findByRole('button', { name: '+ Добавить фазу' }));
      fireEvent.change(screen.getByLabelText(/Название/), { target: { value: ' Поддержка ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
      await waitFor(() => expect(h.addPathPhase).toHaveBeenCalledWith(7, { name: 'Поддержка', goal: null, weeks: 4, templatePhaseId: null }));
    });
  });

  it('«Изменить старт»: поле даты, «Сохранить» шлёт день и закрывает поле', async () => {
    h.getTherapyPath.mockResolvedValue({ path: path([phase({ id: 5 })]) });
    h.setTherapyPathStart.mockResolvedValue({ path: { ...path([phase({ id: 5 })]), startDate: '2026-12-01' } });
    renderLayout();
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить старт' }));
    fireEvent.change(screen.getByDisplayValue('2026-11-02'), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(h.setTherapyPathStart).toHaveBeenCalledWith(7, '2026-12-01'));
    await screen.findByRole('button', { name: 'Изменить старт' });
  });

  it('текущая фаза дольше плана: тихая строка и «Сдвинуть сроки» шлёт один PATCH с новым сроком', async () => {
    const start = shiftCalendarDay(todayStr(), -42);
    const late = { ...path([phase({ id: 5, weeks: 2, startedAt: start })]), startDate: start };
    h.getTherapyPath.mockResolvedValue({ path: late });
    h.updatePathPhase.mockResolvedValue({ path: late });
    renderLayout();
    expect((await screen.findByText(/закончилась 4 недели назад/)).textContent).toContain('сдвинуть сроки?');
    fireEvent.click(screen.getByRole('button', { name: 'Сдвинуть сроки' }));
    await waitFor(() => expect(h.updatePathPhase).toHaveBeenCalledWith(5, { weeks: 6 }));
  });
});
