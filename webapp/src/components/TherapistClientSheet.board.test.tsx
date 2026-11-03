// @vitest-environment jsdom
// Доска «Задания» кабинета и карточка клиента (QA 2026-11):
// 1) задание, назначенное или отмеченное в карточке, появлялось на доске только
//    после перезагрузки — лист кабинета не перемонтируется, доска не перечитывалась;
// 2) клик по заданию на доске открывал карточку на «Обзоре», а не на «Заданиях».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapistClientSheet } from './TherapistClientSheet';
import type { TherapyClientSummary, UserTask } from '../api';

vi.mock('../api', () => ({
  api: {
    getTherapyClients: vi.fn(), getTherapyInvites: vi.fn(() => Promise.resolve([])),
    getTherapyTasksForClient: vi.fn(), getTherapistNotes: vi.fn(), getConceptualization: vi.fn(),
    getTherapyClientData: vi.fn(), getClientSchemaNotes: vi.fn(), getClientModeNotes: vi.fn(),
    getTherapyClientHistory: vi.fn(), getClientDiary: vi.fn(), getAllTherapyTasks: vi.fn(),
    createTask: vi.fn(), completeTask: vi.fn(), deleteTherapyTask: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const OFFLINE = -4;
const anna = {
  telegramId: OFFLINE, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
  recentIndexHistory: [], relationCreatedAt: '2026-01-01T00:00:00.000Z', therapyStartDate: null,
  nextSession: null, meetingDays: [], schemaIds: [],
} as unknown as TherapyClientSummary;
const task = (id: number, text: string, done: boolean | null = null) => ({
  id, userId: OFFLINE, assignedBy: 9, type: 'note', text, targetDays: null, needId: null,
  dueDate: null, done, completedAt: done ? '2026-07-02T00:00:00.000Z' : null, createdAt: '2026-07-01T00:00:00.000Z',
}) as UserTask;
const boardOf = (...tasks: UserTask[]) => [{ clientId: OFFLINE, clientName: 'Анна', tasks }];

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyClients.mockResolvedValue([anna]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getConceptualization.mockResolvedValue(null);
  mockApi.getTherapyClientData.mockResolvedValue({ name: null, mySchemaIds: [], myModeIds: [], ysqCompletedAt: null, ysqActiveSchemaIds: [], ysqHistory: [] });
  for (const k of ['getClientSchemaNotes', 'getClientModeNotes', 'getTherapyClientHistory', 'getClientDiary']) mockApi[k].mockResolvedValue([]);
});
afterEach(cleanup);

function Wrapper() {
  const [view, setView] = useState<'list' | 'client'>('list');
  return <TherapistClientSheet view={view} onViewChange={setView} onClose={vi.fn()} />;
}

async function openBoardTask(text: string) {
  render(<MemoryRouter><Wrapper /></MemoryRouter>);
  await screen.findByText('Анна');
  fireEvent.click(screen.getByRole('tab', { name: 'Задания' }));
  fireEvent.click(await screen.findByText(text));
}

describe('доска «Задания» ↔ карточка клиента', () => {
  it('клик по заданию на доске открывает карточку на вкладке «Задания»', async () => {
    mockApi.getAllTherapyTasks.mockResolvedValue(boardOf(task(1, 'Дневник схем')));
    mockApi.getTherapyTasksForClient.mockResolvedValue([task(1, 'Дневник схем')]);
    await openBoardTask('Дневник схем');
    await screen.findByText('активное домашнее задание');
    expect(screen.getByRole('tab', { name: /Задания/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('отметка «Выполнено» в карточке → доска после «Все клиенты» перечитана', async () => {
    mockApi.getAllTherapyTasks
      .mockResolvedValueOnce(boardOf(task(1, 'Дневник схем')))
      .mockResolvedValueOnce(boardOf(task(1, 'Дневник схем', true)));
    mockApi.getTherapyTasksForClient.mockResolvedValue([task(1, 'Дневник схем')]);
    mockApi.completeTask.mockResolvedValue({});
    await openBoardTask('Дневник схем');
    const done = await screen.findByRole('button', { name: 'Выполнено' });
    await act(async () => { fireEvent.click(done); });
    expect(mockApi.getAllTherapyTasks).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText('← Все клиенты'));
    const doneCol = (await screen.findAllByText('Выполнено')).find(n => n.className === 'ds-label')!.closest('div')!.parentElement!;
    expect(within(doneCol).getByText('Дневник схем')).toBeTruthy();
  });

  it('назначение задания из карточки → доска перечитана', async () => {
    mockApi.getAllTherapyTasks.mockResolvedValue(boardOf(task(1, 'Дневник схем')));
    mockApi.getTherapyTasksForClient.mockResolvedValue([task(1, 'Дневник схем')]);
    mockApi.createTask.mockResolvedValue({});
    await openBoardTask('Дневник схем');
    fireEvent.click(await screen.findByText('+ Назначить'));
    fireEvent.change(screen.getByPlaceholderText(/позвонить другу/), { target: { value: 'Прогулка' } });
    await act(async () => { fireEvent.click(screen.getByText('Назначить задание')); });
    expect(mockApi.createTask).toHaveBeenCalledTimes(1);
    expect(mockApi.getAllTherapyTasks).toHaveBeenCalledTimes(2);
  });
});
