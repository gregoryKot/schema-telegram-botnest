// @vitest-environment jsdom
// Сверка «Это тот же человек?» в списке кабинета (аудит 2026-11, S8): плашка
// стоит над списком, «Да» перечитывает список клиентов — офлайн-карточка
// уходит, а аккаунт получает её имя (сохранил → нашёл на том же экране).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ClientListView } from './ClientListView';
import { useAddClient } from './useAddClient';
import { useTasksBoard } from './useTasksBoard';
import type { RosterStatus } from './rosterModel';
import type { TherapyClientSummary } from '../../api';

vi.mock('../../api', () => ({
  api: {
    addVirtualClient: vi.fn(), createTherapyInvite: vi.fn(), getAllTherapyTasks: vi.fn(),
    getTherapyInvites: vi.fn(() => Promise.resolve([])), revokeTherapyInvite: vi.fn(),
    getCardClaims: vi.fn(), resolveCardClaim: vi.fn(), getTherapyClients: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const base = { streak: 0, meetingDays: [], schemaIds: [], recentIndexHistory: [], lastActiveDate: null, todayIndex: null, daysSinceActive: null } as const;
const card = { ...base, telegramId: -9, name: 'Мария К.', clientAlias: null } as unknown as TherapyClientSummary;
const boris = { ...base, telegramId: 500, name: 'Борис', clientAlias: null } as unknown as TherapyClientSummary;
const merged = { ...boris, clientAlias: 'Мария К.' } as unknown as TherapyClientSummary;
const claim = { clientId: 500, clientName: 'Борис', cardId: 9, cardName: 'Мария К.' };

function Host() {
  const [clients, setClients] = useState<TherapyClientSummary[]>([card, boris]);
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

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getCardClaims.mockResolvedValue([claim]);
  mockApi.resolveCardClaim.mockResolvedValue(undefined);
  mockApi.getTherapyClients.mockResolvedValue([merged]);
});
afterEach(cleanup);

describe('ClientListView — сверка кода офлайн-карточки', () => {
  it('плашка видна над списком; «Да» → список перечитан, карточка ушла', async () => {
    const { container } = render(<Host />);
    const cards = () => container.querySelectorAll('.tc-card').length;
    expect(await screen.findByText(/использовал аккаунт «Борис»/)).toBeTruthy();
    expect(cards()).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'Да, объединить' }));
    await waitFor(() => expect(mockApi.getTherapyClients).toHaveBeenCalledTimes(1));
    expect(mockApi.resolveCardClaim).toHaveBeenCalledWith(500, 9, true);
    await waitFor(() => expect(screen.queryByText(/использовал аккаунт/)).toBeNull());
    await waitFor(() => expect(cards()).toBe(1));
  });

  it('«Нет» → список не перечитывается, плашка уходит', async () => {
    render(<Host />);
    fireEvent.click(await screen.findByRole('button', { name: 'Нет' }));
    await waitFor(() => expect(screen.queryByText(/использовал аккаунт/)).toBeNull());
    expect(mockApi.resolveCardClaim).toHaveBeenCalledWith(500, 9, false);
    expect(mockApi.getTherapyClients).not.toHaveBeenCalled();
  });

  it('список после «Да» не перечитался — сбой уходит в отчёт, не в тишину', async () => {
    mockApi.getTherapyClients.mockRejectedValue(new Error('offline'));
    render(<Host />);
    fireEvent.click(await screen.findByRole('button', { name: 'Да, объединить' }));
    await waitFor(() => expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'therapist.clients' }),
    ));
  });
});
