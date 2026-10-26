// Статус задания у терапевта — одна модель для карточки клиента и доски
// обеих площадок. Регрессия QA 2026-10-26: просроченная серия (`done: false`)
// на доске была «Не вышло», а в карточке — «В работе» и в счётчике активных.
import { describe, it, expect } from 'vitest';
import {
  isOpenStatus,
  orderTasks,
  taskMeta,
  taskStatus,
  STATUS_LABEL,
} from './taskStatus';
import type { UserTask } from '../apiTypes';

const today = '2026-10-15';

function t(over: Partial<UserTask> = {}): UserTask {
  return {
    id: 1,
    userId: 1,
    assignedBy: 2,
    type: 'custom',
    text: 'задание',
    targetDays: null,
    needId: null,
    dueDate: null,
    done: null,
    completedAt: null,
    createdAt: '2026-10-01T12:00:00Z',
    ...over,
  };
}

describe('taskStatus', () => {
  it('выполнено и «не вышло» важнее срока', () => {
    expect(taskStatus({ done: true, dueDate: '2026-10-01' }, today)).toBe(
      'done',
    );
    expect(taskStatus({ done: false, dueDate: '2026-10-01' }, today)).toBe(
      'failed',
    );
    expect(STATUS_LABEL.failed).toBe('Не вышло');
  });
  it('без срока — в работе', () => {
    expect(taskStatus({ done: null, dueDate: null }, today)).toBe('active');
  });
  it('срок через 2 дня и меньше — скоро, сегодня включительно', () => {
    expect(taskStatus({ done: null, dueDate: '2026-10-15' }, today)).toBe(
      'soon',
    );
    expect(taskStatus({ done: null, dueDate: '2026-10-17' }, today)).toBe(
      'soon',
    );
  });
  it('далеко — в работе, прошёл — просрочено', () => {
    expect(taskStatus({ done: null, dueDate: '2026-10-18' }, today)).toBe(
      'active',
    );
    expect(taskStatus({ done: null, dueDate: '2026-10-14' }, today)).toBe(
      'overdue',
    );
  });
  it('активное — только то, что ещё ждёт клиента', () => {
    expect(isOpenStatus('active')).toBe(true);
    expect(isOpenStatus('soon')).toBe(true);
    expect(isOpenStatus('overdue')).toBe(true);
    expect(isOpenStatus('failed')).toBe(false);
    expect(isOpenStatus('done')).toBe(false);
  });
});

describe('orderTasks', () => {
  it('просроченное → скоро → в работе → не вышло → выполнено; внутри — порядок сервера', () => {
    const list = [
      t({ id: 1, done: true }),
      t({ id: 2, done: false }),
      t({ id: 3 }),
      t({ id: 4, dueDate: '2026-10-10' }),
      t({ id: 5, dueDate: '2026-10-16' }),
      t({ id: 6 }),
    ];
    expect(orderTasks(list, today).map((x) => x.id)).toEqual([
      4, 5, 3, 6, 2, 1,
    ]);
  });
});

describe('taskMeta', () => {
  it('у выполненного — дата выполнения, а не «до …»', () => {
    const done = t({
      done: true,
      dueDate: '2026-10-20',
      completedAt: '2026-10-05T12:00:00Z',
    });
    expect(taskMeta(done, 'done')).toBe('выполнено 5 окт');
  });
  it('«не вышло» — когда закрыто, с прогрессом серии', () => {
    const failed = t({
      type: 'tracker_streak',
      done: false,
      targetDays: 3,
      progress: 1,
      completedAt: '2026-10-05T12:00:00Z',
    });
    expect(taskMeta(failed, 'failed')).toBe('закрыто 5 окт · 1 из 3 дней');
  });
  it('у открытого — срок или дата назначения; у серии — «N из M дней»', () => {
    expect(taskMeta(t({ dueDate: '2026-10-20' }), 'active')).toBe('до 20 окт');
    const streak = t({ type: 'diary_streak', targetDays: 7, progress: 1 });
    expect(taskMeta(streak, 'active')).toBe('назначено 1 окт · 1 из 7 дней');
  });
});
