// @vitest-environment jsdom
// «Повторить» при сбое загрузки ростера: скелетон на время повтора, затем список без алерта.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapistClientSheet } from './TherapistClientSheet';
import type { TherapyClientSummary } from '../api';

vi.mock('../api', () => ({
  api: {
    getTherapyClients: vi.fn(),
    getTherapyInvites: vi.fn(() => Promise.resolve([])),
    getCardClaims: vi.fn(() => Promise.resolve([])),
    getAllTherapyTasks: vi.fn(() => Promise.resolve([])),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const anna: TherapyClientSummary = {
  telegramId: 7,
  name: 'Анна',
  clientAlias: null,
  streak: 0,
  lastActiveDate: null,
  todayIndex: null,
  recentIndexHistory: [],
  relationCreatedAt: '2026-01-01T00:00:00.000Z',
  therapyStartDate: null,
  nextSession: null,
  meetingDays: [],
  schemaIds: [],
};

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

function Wrapper() {
  const [view, setView] = useState<'list' | 'client'>('list');
  return <TherapistClientSheet view={view} onViewChange={setView} onClose={vi.fn()} />;
}

describe('TherapistClientSheet: повтор загрузки ростера', () => {
  it('сбой → «Повторить» → второй вызов отдал клиента: имя в списке, алерта нет', async () => {
    mockApi.getTherapyClients
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([anna]);
    render(<MemoryRouter><Wrapper /></MemoryRouter>);
    await act(async () => {});

    expect(screen.getByText(/Не удалось загрузить клиентов/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    await waitFor(() => expect(screen.getByText('Анна')).toBeTruthy());
    expect(screen.queryByText(/Не удалось загрузить клиентов/)).toBeNull();
    expect(mockApi.getTherapyClients).toHaveBeenCalledTimes(2);
  });
});
