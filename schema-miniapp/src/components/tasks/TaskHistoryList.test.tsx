// @vitest-environment jsdom
// TaskHistoryList — история выполненных/невыполненных задач. Пустой список
// не должен рисовать пустой заголовок «Выполнено» (правило пустых
// состояний), а done=true/false обязаны показывать разные иконки —
// смешение их было бы обманом («выполнил», а карточка говорит «нет»).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TaskHistoryList } from './TaskHistoryList';
import type { UserTask } from '../../api';

afterEach(() => {
  cleanup();
});

function makeTask(overrides: Partial<UserTask> = {}): UserTask {
  return {
    id: 1,
    userId: 1,
    assignedBy: null,
    type: 'custom',
    text: 'Прогулка',
    targetDays: null,
    needId: null,
    dueDate: null,
    done: true,
    completedAt: '2026-08-01T10:00:00Z',
    createdAt: '2026-07-30T00:00:00Z',
    ...overrides,
  };
}

describe('TaskHistoryList — пустое состояние', () => {
  it('пустая история — ничего не рендерит (нет заголовка «Выполнено» без записей)', () => {
    const { container } = render(<TaskHistoryList taskHistory={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('TaskHistoryList — содержимое', () => {
  it('done=true — галочка', () => {
    render(<TaskHistoryList taskHistory={[makeTask({ done: true })]} />);
    expect(screen.getByText('✅')).toBeTruthy();
  });

  it('done=false — крестик, не перепутан с галочкой', () => {
    render(<TaskHistoryList taskHistory={[makeTask({ done: false })]} />);
    expect(screen.getByText('❌')).toBeTruthy();
    expect(screen.queryByText('✅')).toBeNull();
  });

  it('заголовок «Выполнено» появляется при непустой истории', () => {
    render(<TaskHistoryList taskHistory={[makeTask()]} />);
    expect(screen.getByText('Выполнено')).toBeTruthy();
  });

  it('показывает текст задачи для каждой записи в списке', () => {
    render(
      <TaskHistoryList
        taskHistory={[
          makeTask({ id: 1, text: 'Прогулка' }),
          makeTask({ id: 2, text: 'Дневник схем' }),
        ]}
      />,
    );
    expect(screen.getByText('Прогулка')).toBeTruthy();
    expect(screen.getByText('Дневник схем')).toBeTruthy();
  });
});
