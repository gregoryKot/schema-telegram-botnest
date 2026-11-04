// @vitest-environment jsdom
// Полный список заданий — один на «Сегодня» («Все задания») и «Практику» («Все цели»).
// QA 2026-11 (A-З8): в «Все задания» у «Проверить убеждение», карточек и серий не было
// ни кнопки, ни нажатия — список был тупиком; статус показывала одинокая точка «·».
// «Готово» есть у любой незакрытой custom-цели — и своей, и назначенной (паритет с мини-аппом).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AllTasksOverlay } from './AllTasksOverlay';
import type { UserTask } from '../../api';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const task = (over: Partial<UserTask>): UserTask => ({
  id: 1, type: 'custom', text: 'Своя цель', done: null, assignedBy: null, createdAt: '2026-11-01T10:00:00.000Z', ...over,
} as UserTask);

function renderOverlay(tasks: UserTask[], history: UserTask[] = []) {
  const props = { onClose: vi.fn(), onOpen: vi.fn(), onComplete: vi.fn(), onAdd: vi.fn() };
  render(
    <MemoryRouter>
      <AllTasksOverlay title="Все задания" tasks={tasks} taskHistory={history} {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe('AllTasksOverlay — кнопка «Готово»', () => {
  it('своя custom-цель закрывается кнопкой', () => {
    const p = renderOverlay([task({ id: 3 })]);
    fireEvent.click(screen.getByText('Готово'));
    expect(p.onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it('назначенная custom-цель тоже; закрытая и не-custom — нет', () => {
    renderOverlay([
      task({ id: 1, assignedBy: 9 as UserTask['assignedBy'], text: 'От терапевта' }),
      task({ id: 2, text: 'Закрытая', done: true }),
      task({ id: 3, type: 'belief_check', text: 'Упражнение' }),
    ]);
    expect(screen.getAllByText('Готово')).toHaveLength(1);
  });
});

describe('AllTasksOverlay — каждое задание открывается тем же маршрутом, что на «Сегодня»', () => {
  it.each([
    ['belief_check', ''],
    ['mode_intro', 'vulnerable_child'],
    ['diary_streak', ''],
    ['tracker_streak', ''],
  ])('%s: нажатие закрывает список и отдаёт задание в onOpen', async (type, text) => {
    const t = task({ id: 7, type: type as UserTask['type'], text, assignedBy: 9 as UserTask['assignedBy'] });
    const p = renderOverlay([t]);
    await act(async () => {}); // запись листа в истории легла
    fireEvent.click(screen.getByText('начать →'));
    await waitFor(() => expect(p.onOpen).toHaveBeenCalledWith(t));
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it('«+ Поставить цель» тоже сначала закрывает список', async () => {
    const p = renderOverlay([task({})]);
    await act(async () => {});
    fireEvent.click(screen.getByText('+ Поставить цель'));
    await waitFor(() => expect(p.onAdd).toHaveBeenCalledTimes(1));
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AllTasksOverlay — статус бейджем из shared/taskStatus, а не точкой', () => {
  it('в работе, выполнено и «не вышло» — словами; одинокой «·» нет', () => {
    renderOverlay(
      [task({ id: 1, type: 'belief_check', text: '' })],
      [task({ id: 2, text: 'Сделала', done: true, completedAt: '2026-11-02T10:00:00.000Z' }),
        task({ id: 3, text: 'Серия', type: 'diary_streak', done: false })],
    );
    expect(screen.getByText('В работе')).toBeTruthy();
    expect(screen.getByText('Выполнено', { selector: '.ds-badge' })).toBeTruthy();
    expect(screen.getByText('Не вышло')).toBeTruthy();
    expect(screen.queryByText('·')).toBeNull();
  });

  // Срок, поставленный терапевтом, сравнивается с местным днём человека (№25):
  // в 23:30 по местному времени срок «сегодня» ещё не просрочен.
  it('срок сравнивается с местным днём в любой зоне', () => {
    forEachTimeZone((tz) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 3, 23, 30));
      try {
        renderOverlay([
          task({ id: 1, text: 'Сегодня', dueDate: '2026-11-03' }),
          task({ id: 2, text: 'Вчера', dueDate: '2026-11-02' }),
        ]);
        expect(screen.getByText('Скоро срок'), tz).toBeTruthy();
        expect(screen.getByText('Просрочено'), tz).toBeTruthy();
      } finally {
        cleanup();
        vi.useRealTimers();
      }
    });
  });
});
