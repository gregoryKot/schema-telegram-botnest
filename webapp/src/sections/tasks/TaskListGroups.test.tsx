// @vitest-environment jsdom
// «Выполнено» на общей Disclosure с keepMounted: свёрнуто, пока есть активные, строки истории остаются в DOM.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { UserTask } from '../../api';
import { TaskListGroups } from './TaskListGroups';

const task = (o: Partial<UserTask>): UserTask => ({
  id: 1, userId: 1, assignedBy: null, type: 'custom', text: 'x', targetDays: null, needId: null,
  dueDate: null, done: null, completedAt: null, createdAt: '2026-11-05T10:00:00.000Z', ...o,
});

const done = [
  task({ id: 2, text: 'Письмо себе', done: true, completedAt: '2026-11-06T10:00:00.000Z' }),
  task({ id: 3, text: 'Прогулка', done: true, completedAt: '2026-11-07T10:00:00.000Z' }),
];

const renderGroups = (mine: UserTask[]) =>
  render(<TaskListGroups groups={{ therapist: [], mine, done }} today="2026-11-10" phone={false} onOpen={() => {}} onComplete={() => {}} />);

afterEach(cleanup);

describe('TaskListGroups: «Выполнено»', () => {
  it('при активных свёрнуто, строки в DOM под hidden, счётчик виден; клик раскрывает и сворачивает', () => {
    renderGroups([task({ id: 1, text: 'Активная цель' })]);
    const toggle = screen.getByRole('button', { name: /Выполнено/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('2');
    expect(screen.getByText('Письмо себе').closest('[hidden]')).not.toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Письмо себе').closest('[hidden]')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Прогулка').closest('[hidden]')).not.toBeNull();
  });

  it('без активных история раскрыта сразу', () => {
    renderGroups([]);
    expect(screen.getByRole('button', { name: /Выполнено/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Прогулка').closest('[hidden]')).toBeNull();
  });
});
