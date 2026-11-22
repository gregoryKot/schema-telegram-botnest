// @vitest-environment jsdom
// Шов раскладки «По фазам»: ответ GET /api/therapy/path → пустое состояние или лента; правки уходят ручками пути.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PathPhase, TherapyPath } from '../../../../../../shared/src/therapy/path/pathModel';
import { phaseDraftsFromTemplate } from '../../../../../../shared/src/therapy/path/pathPlan';
import { pathTemplate } from '../../../../../../shared/src/therapy/path/templates';
import { todayStr } from '../../../../../../shared/src/utils/format';
import type { PlanItem } from '../../../../../../shared/src/therapy/plan/planItem';

const h = vi.hoisted(() => ({
  getTherapyPath: vi.fn(), createTherapyPath: vi.fn(), updatePathPhase: vi.fn(), advancePathPhase: vi.fn(),
}));
vi.mock('../../../../api', () => ({ api: h, reportClientError: vi.fn() }));

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
  return <PathLayout path={state} items={items} renderRow={(i) => <div key={i.id}>{i.text}</div>} />;
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

  it('текущей нет — «Начать фазу» ставит startedAt; путь не загрузился — «Повторить»', async () => {
    const idle = path([phase({ id: 1 })]);
    h.getTherapyPath.mockRejectedValueOnce(new Error('net')).mockResolvedValue({ path: idle });
    h.updatePathPhase.mockResolvedValue({ path: idle });
    renderLayout();
    fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Начать фазу' }));
    await waitFor(() => expect(h.updatePathPhase).toHaveBeenCalledWith(1, { startedAt: todayStr() }));
  });
});
