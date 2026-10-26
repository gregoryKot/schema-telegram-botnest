// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ClientTasksTab } from './ClientTasksTab';
import { ClientNotesTab } from './ClientNotesTab';
import { KanbanView } from './KanbanView';
import type { UserTask } from '../../api';
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

// QA 2026-10-26: серия «Трекер 3 дн» просрочилась, бэкенд закрыл её
// (done=false). Доска показывала «Не вышло», а карточка — «1 активное … В
// работе». Теперь обе берут одну модель статусов (shared/tasks/taskStatus).
describe('ClientTasksTab — «не вышло» и прогресс серии', () => {
  it('закрытая серия — «Не вышло», в активные не считается, стоит после открытых', () => {
    const detail = {
      clientTasks: [
        task(1, { type: 'tracker_streak', text: 'Отмечать потребности 3 дня подряд', targetDays: 3, progress: 1, done: false, completedAt: '2026-10-05T12:00:00Z' }),
        task(2, { text: 'открытое' }),
      ],
      setShowAssign: vi.fn(),
    };
    render(<ClientTasksTab detail={detail as unknown as ClientDetail} />);
    expect(screen.getByText('активное домашнее задание')).toBeTruthy();
    expect(screen.getByText('Не вышло')).toBeTruthy();
    expect(screen.getByText('закрыто 5 окт · 1 из 3 дней')).toBeTruthy();
    const rows = screen.getAllByText(/открытое|Отмечать потребности/).map(n => n.textContent);
    expect(rows).toEqual(['открытое', 'Отмечать потребности 3 дня подряд']);
  });

  it('серия в работе — прогресс «1 из 7 дней», как у клиента «1/7»', () => {
    const detail = {
      clientTasks: [task(1, { type: 'diary_streak', text: 'Заполнять дневник 7 дней подряд', targetDays: 7, progress: 1 })],
      setShowAssign: vi.fn(),
    };
    render(<ClientTasksTab detail={detail as unknown as ClientDetail} />);
    expect(screen.getByText(/1 из 7 дней/)).toBeTruthy();
  });
});

describe('KanbanView — та же модель статусов', () => {
  it('«не вышло» в своей колонке, у выполненного — дата выполнения, просроченное помечено', () => {
    const allTasks = [{ clientId: 1, clientName: 'Анна', tasks: [
      task(1, { text: 'сделано', done: true, dueDate: '2026-10-20', completedAt: '2026-10-05T12:00:00Z' }),
      task(2, { text: 'не вышло', done: false, completedAt: '2026-10-06T12:00:00Z' }),
      task(3, { text: 'просрочено', dueDate: '2020-01-01' }),
    ] as UserTask[] }];
    render(<KanbanView allTasks={allTasks} loading={false} loadFailed={false} onRetry={vi.fn()} onOpenClient={vi.fn()} />);
    expect(screen.getByText('выполнено 5 окт')).toBeTruthy();
    expect(screen.queryByText('до 20 окт')).toBeNull();
    expect(screen.getByText('закрыто 6 окт')).toBeTruthy();
    expect(screen.getByText('Просрочено')).toBeTruthy();
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
