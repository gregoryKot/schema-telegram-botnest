// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ClientTasksTab } from './ClientTasksTab';
import { ClientNotesTab } from './ClientNotesTab';
import { ClientYSQTab } from './ClientYSQTab';
import { KanbanView } from './KanbanView';
import type { ClientData, TherapyClientSummary, UserTask } from '../../api';
import type { ClientDetail } from './clientSheetTypes';

afterEach(cleanup);

const task = (id: number, over: Record<string, unknown>) => ({
  id, userId: 1, assignedBy: 2, type: 'custom', text: `задание ${id}`, targetDays: null, needId: null,
  dueDate: null, done: null, completedAt: null, createdAt: '2026-10-01T10:00:00Z', ...over,
});

describe('ClientTasksTab', () => {
  it('считает активные, склоняет подпись, шаблон открывает назначение', () => {
    const setShowAssign = vi.fn();
    const detail = { clientTasks: [task(1, {}), task(2, {}), task(3, { done: true, completedAt: '2026-10-05T10:00:00Z' })], setShowAssign };
    render(<ClientTasksTab detail={detail as unknown as ClientDetail} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('активных домашних задания')).toBeTruthy();
    expect(screen.getByText('Выполнено')).toBeTruthy();
    fireEvent.click(screen.getByText('Дневник режима'));
    expect(setShowAssign).toHaveBeenCalledWith(true);
  });

  // Регрессия: терапевт видел сырой id режима «invincible_oc» вместо
  // названия — вкладка рисовала task.text как есть.
  it('mode_intro — название режима, сырой id не виден', () => {
    const detail = { clientTasks: [task(1, { type: 'mode_intro', text: 'invincible_oc' })], setShowAssign: vi.fn() };
    render(<ClientTasksTab detail={detail as unknown as ClientDetail} />);
    expect(screen.getByText('Карточка режима: Неуязвимый Гиперконтролёр')).toBeTruthy();
    expect(screen.queryByText(/invincible_oc/)).toBeNull();
  });
});

describe('KanbanView', () => {
  it('mode_intro — название режима, сырой id не виден', () => {
    const allTasks = [{ clientId: 1, clientName: 'Анна', tasks: [task(1, { type: 'mode_intro', text: 'invincible_oc' })] as UserTask[] }];
    render(<KanbanView allTasks={allTasks} loading={false} loadFailed={false} onRetry={vi.fn()} onOpenClient={vi.fn()} />);
    expect(screen.getByText('Карточка режима: Неуязвимый Гиперконтролёр')).toBeTruthy();
    expect(screen.queryByText(/invincible_oc/)).toBeNull();
  });
});

describe('ClientNotesTab', () => {
  it('фильтр по типу и раскрытие карточки с полями', () => {
    render(<ClientNotesTab
      clientDiary={[{ type: 'gratitude', date: '2026-10-02', excerpt: 'спасибо за день' }]}
      clientModeNotesData={[{ modeId: 'x', triggers: 'шум', feelings: '', thoughts: '', needs: '', behavior: '', origins: '', healthyView: '', modeFunction: '', needsMet: '' }]}
      clientSchemaNotesData={[]}
    />);
    expect(screen.getByText('спасибо за день')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Режимы/ }));
    expect(screen.queryByText('спасибо за день')).toBeNull();
    expect(screen.queryByText('шум')).toBeNull();
    fireEvent.click(screen.getByText('Режим-карточка'));
    expect(screen.getByText('шум')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Схемы/ }));
    expect(screen.getByText('В этой категории записей нет')).toBeTruthy();
  });
});

// #906: заголовков у вкладок карточки клиента нет ни на одной — имя уже во
// вкладке шапки (решение #902 для «Концептуализации» распространено на все);
// пустые состояния — общий ds-empty, а не свой курсив/центровка.
describe('вкладки без заголовков, пустые состояния — ds-empty (#906)', () => {
  it('«Записи клиента»: h2 нет, первым идёт фильтр; пустая категория — ds-empty', () => {
    const { container } = render(<ClientNotesTab
      clientDiary={[{ type: 'gratitude', date: '2026-10-02', excerpt: 'спасибо за день' }]}
      clientModeNotesData={[]}
      clientSchemaNotesData={[]}
    />);
    expect(container.querySelector('h2')).toBeNull();
    expect(screen.queryByText('Записи клиента')).toBeNull();
    expect(container.querySelector('.ds-page')!.firstElementChild!.getAttribute('role')).toBe('tablist');
    fireEvent.click(screen.getByRole('tab', { name: /Схемы/ }));
    expect(screen.getByText('В этой категории записей нет').classList.contains('ds-empty')).toBe(true);
  });

  it('«Записи клиента» без единой записи — ds-empty', () => {
    render(<ClientNotesTab clientDiary={[]} clientModeNotesData={[]} clientSchemaNotesData={[]} />);
    expect(screen.getByText('Клиент ещё не заполнял дневник').classList.contains('ds-empty')).toBe(true);
  });

  it('YSQ с прохождениями: h2 «Опросник схем YSQ» нет, строка прохождений и действия остаются', () => {
    const run = { id: 1, completedAt: '2026-10-01T10:00:00Z', scores: [{ id: 'failure', pct5plus: 70 }] };
    const clientData = { ysqHistory: [run], ysqCompletedAt: '2026-10-01T10:00:00Z' } as unknown as ClientData;
    const selectedClient = { telegramId: 7 } as unknown as TherapyClientSummary;
    const { container } = render(<ClientYSQTab
      clientData={clientData} selectedClient={selectedClient} selfSchemaIds={[]} ysqSchemaIds={['failure']}
      ysqRequested={false} ysqError="" exportCopied={false} handleRequestYsq={vi.fn()} handleExport={vi.fn()}
    />);
    expect(container.querySelector('h2')).toBeNull();
    expect(screen.queryByText('Опросник схем YSQ')).toBeNull();
    expect(screen.getByText(/1 прохождение · последнее/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Экспорт' })).toBeTruthy();
  });

  it('«Задания» без заданий — ds-empty', () => {
    render(<ClientTasksTab detail={{ clientTasks: [], setShowAssign: vi.fn() } as unknown as ClientDetail} />);
    expect(screen.getByText(/Нет назначенных заданий/).classList.contains('ds-empty')).toBe(true);
  });
});
