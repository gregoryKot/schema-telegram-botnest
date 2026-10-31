// @vitest-environment jsdom
// «Восстановить версию» концептуализации на сайте (паритет с мини-аппом,
// этап 3): подтверждение → поля версии уходят в автосохранение (настоящий
// useClientDetail, мок только сети). Отмена не пишет ничего.
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

vi.mock('../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(),
    getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(),
    getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(),
    getClientModeNotes: vi.fn(),
    getTherapyClientHistory: vi.fn(),
    getClientDiary: vi.fn(),
    saveConceptualization: vi.fn(),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { ClientConceptTab } from './ClientConceptTab';
import { useClientDetail } from './useClientDetail';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CLIENT = {
  telegramId: 7,
  name: 'Анна',
  clientAlias: null,
  streak: 0,
  lastActiveDate: null,
  todayIndex: null,
  recentIndexHistory: [],
  relationCreatedAt: '2026-01-01',
  therapyStartDate: null,
  nextSession: null,
  meetingDays: [],
  schemaIds: [],
};

const LINK = {
  modeId: 'punitive_critic',
  alias: 'Судья',
  schemaIds: ['failure'],
  needIds: ['limits'],
  origin: 'строгий отец',
  manifest: '',
  strategy: '',
};

const concept = (patch: Record<string, unknown> = {}) => ({
  id: 1,
  therapistId: 1,
  clientId: 7,
  schemaIds: ['failure'],
  modeIds: ['punitive_critic'],
  earlyExperience: null,
  unmetNeeds: null,
  triggers: null,
  copingStyles: null,
  goals: null,
  currentProblems: null,
  modeTransitions: null,
  modeLinks: [LINK],
  schemaLinks: [],
  modeMapNodes: [],
  modeMapEdges: [],
  history: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});

function Harness() {
  const detail = useClientDetail({
    switchView: () => {},
    setClients: () => {},
  });
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void detail.openClient(CLIENT as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!detail.selectedClient || detail.tabLoading) return <div>загрузка</div>;
  return <ClientConceptTab detail={detail} />;
}

async function openTab(server: unknown) {
  mockApi.getConceptualization.mockResolvedValue(server);
  render(<Harness />);
  await screen.findByText('Концептуализация');
}

const saved = () => mockApi.saveConceptualization.mock.calls.at(-1)?.[1];

const OLD = {
  savedAt: '2026-08-01T10:00:00Z',
  schemaIds: ['abandonment'],
  modeIds: ['vulnerable_child'],
  earlyExperience: 'старый опыт',
  unmetNeeds: null,
  triggers: null,
  copingStyles: null,
  goals: 'старая цель',
  currentProblems: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  mockApi.saveConceptualization.mockImplementation(
    async (_id: number, body: object) => concept(body),
  );
});

afterEach(() => cleanup());

async function openVersion() {
  await openTab(concept({ modeIds: [], modeLinks: [], schemaIds: [], history: [OLD] }));
  fireEvent.click(screen.getByRole('button', { name: 'История версий · 1' }));
  fireEvent.click(screen.getByText('Версия 1'));
  fireEvent.click(screen.getByRole('button', { name: 'Восстановить эту версию' }));
}

describe('ClientConceptTab: восстановление версии', () => {
  it('подтверждение: поля версии уходят в автосохранение', async () => {
    await openVersion();
    expect(screen.getByText('Восстановить версию 1?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Восстановить' }));
    await waitFor(() => expect(saved()).toBeTruthy(), { timeout: 2500 });
    expect(saved().schemaIds).toEqual(['abandonment']);
    expect(saved().modeIds).toEqual(['vulnerable_child']);
    expect(saved().earlyExperience).toBe('старый опыт');
    expect(saved().goals).toBe('старая цель');
    expect(screen.queryByText('Восстановить версию 1?')).toBeNull();
  });

  it('отмена закрывает диалог и ничего не сохраняет', async () => {
    await openVersion();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByText('Восстановить версию 1?')).toBeNull();
    await new Promise((r) => setTimeout(r, 900));
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled();
  });
});
