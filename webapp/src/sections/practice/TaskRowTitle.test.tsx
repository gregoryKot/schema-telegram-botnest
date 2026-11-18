// @vitest-environment jsdom
// Клиент в задании из справочника видит «что делать» и «зачем»; задание без catalogId — как раньше.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TaskRowTitle } from './TaskRowTitle';
import { taskWhy } from '../../../../shared/src/tasks/catalog/taskWhy';
import type { UserTask } from '../../api';

const task = (over: Partial<UserTask>): UserTask => ({
  id: 1, userId: 5, assignedBy: 9, type: 'custom', text: 'Тайм-аут\nВыйти на десять минут.', targetDays: null,
  needId: null, dueDate: null, done: null, completedAt: null, createdAt: '2026-11-18T10:00:00Z', ...over,
});

afterEach(() => { cleanup(); });

describe('TaskRowTitle', () => {
  it('задание из справочника: название, «что делать» и «зачем» отдельными частями', () => {
    render(<TaskRowTitle task={task({ catalogId: 'тайм-аут' })} />);
    expect(screen.getByText('Тайм-аут')).toBeTruthy();
    expect(screen.getByText(/Выйти на десять минут/)).toBeTruthy();
    expect(screen.getByText('Зачем')).toBeTruthy();
    expect(document.body.textContent?.replace(/\u00a0/g, ' ')).toContain(taskWhy('тайм-аут', (ty) => ty)!.slice(0, 20));
  });

  it('без catalogId и с незнакомым id — только текст задания, «Зачем» нет', () => {
    render(<TaskRowTitle task={task({})} />);
    expect(screen.queryByText('Зачем')).toBeNull();
    cleanup();
    render(<TaskRowTitle task={task({ catalogId: 'нет-такого' })} />);
    expect(screen.queryByText('Зачем')).toBeNull();
    expect(document.body.textContent).toContain('Тайм-аут');
  });
});
