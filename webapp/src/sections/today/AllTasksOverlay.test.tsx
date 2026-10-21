// @vitest-environment jsdom
// «Все задания»: «Готово» есть у любой незакрытой custom-цели — и своей
// (assignedBy === null), и назначенной терапевтом (паритет с мини-аппом).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AllTasksOverlay } from './AllTasksOverlay';
import type { UserTask } from '../../api';

afterEach(cleanup);

const task = (over: Partial<UserTask>): UserTask => ({
  id: 1, type: 'custom', text: 'Своя цель', done: null, assignedBy: null, ...over,
} as UserTask);

function renderOverlay(tasks: UserTask[], onTaskDone = vi.fn()) {
  render(
    <MemoryRouter>
      <AllTasksOverlay tasks={tasks} taskHistory={[]} onClose={() => {}} onTaskDone={onTaskDone} onAddTask={() => {}} />
    </MemoryRouter>,
  );
  return onTaskDone;
}

describe('AllTasksOverlay — кнопка «Готово»', () => {
  it('своя custom-цель закрывается кнопкой', () => {
    const onTaskDone = renderOverlay([task({ id: 3 })]);
    fireEvent.click(screen.getByText('Готово'));
    expect(onTaskDone).toHaveBeenCalledWith(3);
  });

  it('назначенная custom-цель тоже; закрытая и не-custom — нет', () => {
    renderOverlay([
      task({ id: 1, assignedBy: 9, text: 'От терапевта' }),
      task({ id: 2, text: 'Закрытая', done: true }),
      task({ id: 3, type: 'belief_check', text: 'Упражнение' }),
    ]);
    expect(screen.getAllByText('Готово')).toHaveLength(1);
  });
});
