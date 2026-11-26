// @vitest-environment jsdom
// Строка цели на «Практике» (паритет с FullTaskRow мини-аппа): «Готово» у
// своих целей, серая строка с подписью у серии, сделанной сегодня.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TaskRow } from './TaskRow';
import { taskRowState } from './taskRowState';
import { SEGMENTED_MAX, groupTasks, progressSegments, rowStatus } from './taskListModel';
import { taskEntity } from './taskEntity';
import type { UserTask } from '../../api';

afterEach(cleanup);

const task = (over: Partial<UserTask> = {}): UserTask => ({
  id: 1, type: 'custom', text: 'Позвонить другу', done: null, assignedBy: null, ...over,
} as UserTask);

describe('taskRowState', () => {
  // QA 2026-10-26: строка своего задания выглядела нажимаемой и не делала
  // ничего — действие у неё одно, «Готово».
  it('своя custom-цель: «Готово» есть, стрелки и открытия по тапу нет', () => {
    const st = taskRowState(task(), true);
    expect(st.showComplete).toBe(true);
    expect(st.showCta).toBe(false);
    expect(st.openable).toBe(false);
  });

  it('custom с id схемы открывает карточку, поэтому стрелка остаётся', () => {
    expect(taskRowState(task({ text: 'abandonment' }), false).showCta).toBe(true);
  });

  it('без обработчика, у закрытых и у не-custom «Готово» нет', () => {
    expect(taskRowState(task(), false).showComplete).toBe(false);
    expect(taskRowState(task({ done: true }), true).showComplete).toBe(false);
    expect(taskRowState(task({ type: 'belief_check' }), true).showComplete).toBe(false);
    expect(taskRowState(task({ type: 'belief_check' }), true).showCta).toBe(true);
  });

  it('серия, сделанная сегодня: не открывается, подпись только у серий', () => {
    const streak = taskRowState(task({ type: 'diary_streak', doneToday: true }), true);
    expect(streak).toMatchObject({ doneToday: true, openable: false, showCta: false, streakNote: true });
    expect(taskRowState(task({ type: 'custom', doneToday: true }), true).streakNote).toBe(false);
  });
});

describe('TaskRow', () => {
  it('compact: шеврон вместо текста cta, клик по строке открывает задание', () => {
    const onOpen = vi.fn();
    const { container } = render(<TaskRow task={task({ type: 'belief_check' })} cta="начать →" compact onOpen={onOpen} />);
    expect(container.querySelector('.ds-chev')).toBeTruthy();
    expect(screen.queryByText('начать →')).toBeNull();
    fireEvent.click(screen.getByText('Позвонить другу'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('«Готово» вызывает onComplete и не открывает строку', async () => {
    const onOpen = vi.fn();
    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(<TaskRow task={task()} cta="открыть →" onOpen={onOpen} onComplete={onComplete} />);
    fireEvent.click(screen.getByText('Готово'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Готово')).toBeTruthy());
  });

  it('серия за сегодня: серая строка с подписью, тап не открывает', () => {
    const onOpen = vi.fn();
    render(<TaskRow task={task({ type: 'tracker_streak', text: '', doneToday: true })} cta="открыть →" onOpen={onOpen} onComplete={() => {}} />);
    expect(screen.getByText('Сделано сегодня — завтра снова')).toBeTruthy();
    expect(screen.queryByText('Готово')).toBeNull();
    expect(screen.queryByText('открыть →')).toBeNull();
    fireEvent.click(screen.getByText('Сделано сегодня — завтра снова'));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('обычное задание: стрелка и открытие по тапу', () => {
    const onOpen = vi.fn();
    render(<TaskRow task={task({ type: 'belief_check', text: '' })} cta="начать →" onOpen={onOpen} />);
    fireEvent.click(screen.getByText('начать →'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('taskRowState — вид строки и группы списка (b20)', () => {
  it('статус в строке — только «Скоро срок» и «Просрочено»', () => {
    expect(rowStatus('soon')).toBe('soon');
    expect(rowStatus('overdue')).toBe('overdue');
    expect(rowStatus('active')).toBeNull();
    expect(rowStatus('done')).toBeNull();
    expect(rowStatus(undefined)).toBeNull();
  });

  it('серия до 14 дней — штрих на день, длиннее — сплошная полоса', () => {
    expect(progressSegments(4, 7)).toEqual([true, true, true, true, false, false, false]);
    expect(progressSegments(0, SEGMENTED_MAX)).toHaveLength(SEGMENTED_MAX);
    expect(progressSegments(10, 30)).toBeNull();
    expect(progressSegments(0, 0)).toBeNull();
  });

  it('группы: от терапевта, свои, выполненные — без потерь и пересечений', () => {
    const by = 7 as UserTask['assignedBy'];
    const g = groupTasks([task({ id: 1, assignedBy: by }), task({ id: 2 }), task({ id: 3, assignedBy: by })], [task({ id: 4, done: true })]);
    expect(g.therapist.map(t => t.id)).toEqual([1, 3]);
    expect(g.mine.map(t => t.id)).toEqual([2]);
    expect(g.done.map(t => t.id)).toEqual([4]);
  });

  it('сущность задания — по маршруту: упражнение своё, своё задание — «задание»', () => {
    expect(taskEntity({ type: 'letter_to_self', text: '' })).toBe('letter');
    expect(taskEntity({ type: 'diary_streak', text: '' })).toBe('diary');
    expect(taskEntity({ type: 'custom', text: 'Позвонить' })).toBe('task');
  });
});

describe('TaskRow — мета и колонка действия (b20)', () => {
  it('«от терапевта» — в мете со знаком, а не красной полосой; «В работе» не показывается', () => {
    const by = 7 as UserTask['assignedBy'];
    const { container } = render(<TaskRow task={task({ type: 'belief_check', assignedBy: by })} mark status="active" cta="начать →" onOpen={() => {}} />);
    expect(container.querySelector('.cp-task-from')?.textContent).toBe('от терапевта');
    expect(container.querySelector('.cp-task-bar')).toBeNull();
    expect(screen.queryByText('В работе')).toBeNull();
  });

  it('«Скоро срок» — в мете; «Готово» — круглая кнопка последней в ряду', () => {
    const { container } = render(<TaskRow task={task({ dueDate: '2026-11-12' })} status="soon" cta="открыть →" onOpen={() => {}} onComplete={() => {}} />);
    expect(screen.getByText('Скоро срок')).toBeTruthy();
    const row = container.querySelector('.cp-task')!;
    expect(row.lastElementChild?.classList.contains('cp-task-done')).toBe(true);
    expect(screen.getByRole('button', { name: 'Готово' })).toBe(row.lastElementChild);
  });
});
