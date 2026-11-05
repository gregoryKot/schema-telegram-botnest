// @vitest-environment jsdom
// Фильтры списка клиентов (QA 2026-11, T-18): фильтр «Ждут» означал «в боте,
// но сегодня без активности» и путался с блоком «Ждут подключения»
// (приглашения). Теперь он «Не сегодня», логика та же — filterRoster('wait').
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ClientListView } from './ClientListView';
import { useAddClient } from './useAddClient';
import { useTasksBoard } from './useTasksBoard';
import type { RosterStatus } from './rosterModel';
import type { TherapyClientSummary } from '../../api';

vi.mock('../../api', () => ({
  api: {
    addVirtualClient: vi.fn(), createTherapyInvite: vi.fn(), getAllTherapyTasks: vi.fn(),
    getTherapyInvites: vi.fn(() => Promise.resolve([])), revokeTherapyInvite: vi.fn(),
  },
}));

const base = { clientAlias: null, streak: 0, meetingDays: [], schemaIds: [], recentIndexHistory: [], lastActiveDate: null, todayIndex: null } as const;
const CLIENTS = [
  { ...base, telegramId: 1, name: 'Отмечалась', daysSinceActive: 0 },
  { ...base, telegramId: 2, name: 'Вчерашний', daysSinceActive: 1 },
  { ...base, telegramId: -3, name: 'Без бота', daysSinceActive: null },
] as unknown as TherapyClientSummary[];

function Host() {
  const [clients, setClients] = useState<TherapyClientSummary[]>(CLIENTS);
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

afterEach(cleanup);

describe('ClientListView — фильтр «Не сегодня»', () => {
  it('показывает подключённых без активности сегодня; слова «Ждут» в фильтрах нет', () => {
    render(<Host />);
    expect(screen.queryByRole('button', { name: 'Ждут' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Не сегодня' }));
    expect(screen.getByText('Вчерашний')).toBeTruthy();
    expect(screen.queryByText('Отмечалась')).toBeNull();
    expect(screen.queryByText('Без бота')).toBeNull();
  });
});
