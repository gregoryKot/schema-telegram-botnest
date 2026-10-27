// @vitest-environment jsdom
// Проводка «Открыть на холсте» в кабинете терапевта: кнопка на вкладке
// «Концептуализация» создаёт карту, кабинет переключается на «Карту режимов» и
// просит селектор открыть именно её (initialMapId). Сам селектор — стаб с
// печатью пропсов: его выбор карты проверен в ModeMapSelector.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TherapistClientSheet } from './TherapistClientSheet';

vi.mock('../api', () => ({
  api: {
    getTherapyClients: vi.fn(),
    getTherapyInvites: vi.fn(() => Promise.resolve([])),
    revokeTherapyInvite: vi.fn(),
    getTherapyTasksForClient: vi.fn(),
    getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(),
    getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(),
    getClientModeNotes: vi.fn(),
    getTherapyClientHistory: vi.fn(),
    getClientDiary: vi.fn(),
    saveConceptualization: vi.fn(),
    createModeMap: vi.fn(),
    updateModeMap: vi.fn(),
    deleteModeMap: vi.fn(),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
vi.mock('./ModeMapSelector', () => ({
  ModeMapSelector: ({ clientId, initialMapId }: { clientId: number; initialMapId?: number }) => (
    <div data-testid="selector-stub">client:{clientId} initial:{String(initialMapId)}</div>
  ),
}));
import { api } from '../api';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const concept = {
  id: 1, therapistId: 1, clientId: 7, schemaIds: [], modeIds: ['vulnerable_child'],
  earlyExperience: null, unmetNeeds: null, triggers: null, copingStyles: null, goals: null,
  currentProblems: null, modeTransitions: null, modeLinks: [], schemaLinks: [],
  modeMapNodes: [], modeMapEdges: [], history: [], updatedAt: '2026-10-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyClients.mockResolvedValue([
    { telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
      recentIndexHistory: [], relationCreatedAt: '2026-01-01T00:00:00.000Z', therapyStartDate: null,
      nextSession: null, meetingDays: [], schemaIds: [] },
  ]);
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getConceptualization.mockResolvedValue(concept);
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  mockApi.createModeMap.mockResolvedValue({ id: 55, title: 'x', kind: 'personality' });
  mockApi.updateModeMap.mockResolvedValue({});
});
afterEach(() => cleanup());

function Wrapper() {
  const [view, setView] = useState<'list' | 'client'>('list');
  return <TherapistClientSheet view={view} onViewChange={setView} onClose={vi.fn()} />;
}

describe('TherapistClientSheet — «Открыть на холсте»', () => {
  it('создаёт карту, переключает на «Карту режимов» и просит селектор открыть именно её', async () => {
    render(<Wrapper />);
    fireEvent.click(await screen.findByText('Анна'));
    await screen.findByText('Обзор');
    fireEvent.click(screen.getByText('Концептуализация'));
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть на холсте' }));

    const stub = await screen.findByTestId('selector-stub');
    expect(stub.textContent).toBe('client:7 initial:55');
    // карта сначала сохранена, потом показана: на холсте не пусто
    expect(mockApi.updateModeMap).toHaveBeenCalledWith(55, expect.objectContaining({ nodes: expect.any(Array) }));
    expect(screen.queryByRole('button', { name: 'Открыть на холсте' })).toBeNull();
  });

  it('отказ создания: остаёмся на вкладке с сообщением, селектор не открывается', async () => {
    mockApi.createModeMap.mockRejectedValue(new Error('500'));
    render(<Wrapper />);
    fireEvent.click(await screen.findByText('Анна'));
    await screen.findByText('Обзор');
    fireEvent.click(screen.getByText('Концептуализация'));
    fireEvent.click(await screen.findByRole('button', { name: 'Открыть на холсте' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByTestId('selector-stub')).toBeNull();
  });
});
