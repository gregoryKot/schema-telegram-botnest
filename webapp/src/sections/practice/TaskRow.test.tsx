// @vitest-environment jsdom
// Строка цели на «Практике» (паритет с FullTaskRow мини-аппа): «Готово» у
// своих целей, серая строка с подписью у серии, сделанной сегодня.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TaskRow } from './TaskRow';
import { taskRowState } from './taskRowState';
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
