// @vitest-environment jsdom
// AllTasksSheet — лист «Мои цели» (0% покрытия): пустое состояние (правило
// «никаких хардкод-заглушек» — на чистом аккаунте текст-приглашение, а не
// придуманные цели), счётчик активных/выполненных, клик по своей задаче
// завершает её через api.completeTask и вызывает reload (read-after-write).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { AllTasksSheet } from './AllTasksSheet';
import { AddressFormContext } from '../../utils/addressForm';
import type { UserTask } from '../../apiTypes';

vi.mock('../../api', () => ({
  api: { completeTask: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function task(overrides: Partial<UserTask> = {}): UserTask {
  return {
    id: 1,
    userId: 1,
    assignedBy: null,
    type: 'custom',
    text: 'Своя цель',
    targetDays: null,
    needId: null,
    dueDate: null,
    done: null,
    completedAt: null,
    // Относительная дата (не литерал) — createdAt тут не влияет на логику
    // AllTasksSheet, но правило проекта запрещает даты-литералы в тестах.
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('AllTasksSheet — пустое состояние (без выдуманных целей)', () => {
  it('без задач показывает текст-приглашение, а не список/цифры', () => {
    render(
      <AllTasksSheet
        tasks={[]}
        taskHistory={[]}
        onClose={() => {}}
        onOpenTask={() => {}}
        onReload={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(
      screen.getByText(/Поставь себе цель и иди к ней маленькими шагами/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Поставь первую — большие изменения начинаются с малого/,
      ),
    ).toBeTruthy();
    // Нет ни одной цифры-счётчика активных целей на пустом аккаунте.
    expect(screen.queryByText(/\d+\s+активн/)).toBeNull();
  });

  it('звучит на «вы» — обе строки приглашения', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
        <AllTasksSheet
          tasks={[]}
          taskHistory={[]}
          onClose={() => {}}
          onOpenTask={() => {}}
          onReload={() => {}}
          onAdd={() => {}}
        />
      </AddressFormContext.Provider>,
    );
    expect(
      screen.getByText(/Поставьте себе цель и идите к ней маленькими шагами/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Поставьте первую — большие изменения начинаются с малого/,
      ),
    ).toBeTruthy();
  });
});

describe('AllTasksSheet — счётчик реальных задач', () => {
  it('с реальными задачами показывает их число, склонённое верно (2-4 → «активные»)', () => {
    render(
      <AllTasksSheet
        tasks={[task({ id: 1 }), task({ id: 2 })]}
        taskHistory={[]}
        onClose={() => {}}
        onOpenTask={() => {}}
        onReload={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText(/2 активные/)).toBeTruthy();
  });

  it('с историей выполнения добавляет её к счётчику', () => {
    render(
      <AllTasksSheet
        tasks={[task({ id: 1 })]}
        taskHistory={[task({ id: 2, done: true })]}
        onClose={() => {}}
        onOpenTask={() => {}}
        onReload={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText(/1 выполнено/)).toBeTruthy();
  });
});

describe('AllTasksSheet — открытие задачи по клику', () => {
  it('клик по строке задачи вызывает onOpenTask именно с этой задачей', () => {
    const onOpenTask = vi.fn();
    const t = task({ id: 5, text: 'Медитация' });
    render(
      <AllTasksSheet
        tasks={[t]}
        taskHistory={[]}
        onClose={() => {}}
        onOpenTask={onOpenTask}
        onReload={() => {}}
        onAdd={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Медитация'));
    expect(onOpenTask).toHaveBeenCalledWith(t);
  });
});

describe('AllTasksSheet — завершение своей задачи (read-after-write)', () => {
  it('completeTask вызывается для незавершённой custom-задачи и после успеха дёргает onReload', async () => {
    mockApi.completeTask.mockResolvedValue(undefined);
    const onReload = vi.fn();
    const t = task({ id: 7, type: 'custom', done: null });
    render(
      <AllTasksSheet
        tasks={[t]}
        taskHistory={[]}
        onClose={() => {}}
        onOpenTask={() => {}}
        onReload={onReload}
        onAdd={() => {}}
      />,
    );
    // FullTaskRow рисует кнопку «Готово» только для custom-задач без done.
    fireEvent.click(screen.getByText('Готово'));

    await waitFor(() =>
      expect(mockApi.completeTask).toHaveBeenCalledWith(7, true),
    );
    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1));
  });
});

describe('AllTasksSheet — добавление новой цели', () => {
  it('клик по «Поставить цель» вызывает onAdd', () => {
    const onAdd = vi.fn();
    render(
      <AllTasksSheet
        tasks={[]}
        taskHistory={[]}
        onClose={() => {}}
        onOpenTask={() => {}}
        onReload={() => {}}
        onAdd={onAdd}
      />,
    );
    fireEvent.click(screen.getByText('Поставить цель'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
