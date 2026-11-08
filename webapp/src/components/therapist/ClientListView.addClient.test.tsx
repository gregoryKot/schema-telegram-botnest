// @vitest-environment jsdom
// «+ Новый клиент» в списке кабинета (QA 2026-11):
// 1) первый клиент из пустого списка → «Добавить ещё» прятало форму: сброс
//    `created` гасил последнее условие видимости, а открытой её держал только онбординг;
// 2) двойной Enter в поле имени создавал двух клиентов.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ClientListView } from './ClientListView';
import { useAddClient } from './useAddClient';
import { useTasksBoard } from './useTasksBoard';
import type { RosterStatus } from './rosterModel';
import type { TherapyClientSummary } from '../../api';

vi.mock('../../api', () => ({
  api: {
    addVirtualClient: vi.fn(), createTherapyInvite: vi.fn(), getAllTherapyTasks: vi.fn(),
    getTherapyInvites: vi.fn(() => Promise.resolve([])), revokeTherapyInvite: vi.fn(),
    getCardClaims: vi.fn(() => Promise.resolve([])), resolveCardClaim: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const anna = { telegramId: -1, name: null, clientAlias: 'Анна К.', streak: 0, meetingDays: [], schemaIds: [], recentIndexHistory: [] } as unknown as TherapyClientSummary;

function Host() {
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [listTab, setListTab] = useState<'clients' | 'kanban'>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<RosterStatus>('all');
  const addClient = useAddClient({ setClients });
  const board = useTasksBoard();
  return (
    <ClientListView
      animKey={0} clients={clients} loading={false} loadFailed={false}
      listTab={listTab} setListTab={setListTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
      filterStatus={filterStatus} setFilterStatus={setFilterStatus}
      board={board} openClient={vi.fn()} addClient={addClient}
    />
  );
}

const nameInput = () => screen.queryByLabelText('Имя клиента');

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.addVirtualClient.mockResolvedValue([anna]);
});
afterEach(cleanup);

describe('ClientListView — добавление клиента', () => {
  it('первый клиент из пустого списка → «Добавить ещё» оставляет форму открытой', async () => {
    render(<Host />);
    fireEvent.change(nameInput()!, { target: { value: 'Анна К.' } });
    await act(async () => { fireEvent.click(screen.getByText('Создать карточку')); });
    expect(screen.getByText('Клиент добавлен')).toBeTruthy();

    fireEvent.click(screen.getByText('Добавить ещё'));
    expect(nameInput()).not.toBeNull();

    // «к списку» — форма свёрнута, клиент в списке
    fireEvent.change(nameInput()!, { target: { value: 'Борис' } });
    await act(async () => { fireEvent.click(screen.getByText('Создать карточку')); });
    fireEvent.click(screen.getByText('к списку'));
    expect(nameInput()).toBeNull();
    expect(screen.getByText('Офлайн')).toBeTruthy();
  });

  it('двойной Enter в поле имени — один запрос, один клиент', async () => {
    let resolve!: (v: TherapyClientSummary[]) => void;
    mockApi.addVirtualClient.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<Host />);
    fireEvent.change(nameInput()!, { target: { value: 'Анна К.' } });
    fireEvent.keyDown(nameInput()!, { key: 'Enter' });
    fireEvent.keyDown(nameInput()!, { key: 'Enter' });
    await act(async () => { resolve([anna]); });
    expect(mockApi.addVirtualClient).toHaveBeenCalledTimes(1);
  });
});
