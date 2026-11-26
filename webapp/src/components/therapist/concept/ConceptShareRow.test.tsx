// @vitest-environment jsdom
// «Показать клиенту» во вкладке «Концептуализация»: положение тумблера — с сервера
// (концептуализация несёт sharedWithClientAt), нажатие зовёт PATCH и отражает ответ,
// подпись говорит, что увидит клиент; отказ — строка ошибки, положение прежнее;
// офлайн-клиенту строки нет. Поверх НАСТОЯЩЕГО useClientDetail, мок только сети.
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../api', () => ({
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
    shareConceptualization: vi.fn(),
    trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../../api';
import { ClientConceptTab } from '../ClientConceptTab';
import { useClientDetail } from '../useClientDetail';
import { CONCEPT_SHARED_EVENT } from '../../../../../shared/src/share/analytics';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const client = (telegramId: number) => ({
  telegramId, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
});
const concept = (sharedWithClientAt: string | null) => ({
  id: 1, therapistId: 1, clientId: 7, schemaIds: ['failure'], modeIds: [],
  earlyExperience: null, unmetNeeds: null, triggers: null, copingStyles: null, goals: null,
  currentProblems: null, modeTransitions: null, modeLinks: [], schemaLinks: [],
  modeMapNodes: [], modeMapEdges: [], history: [], sharedWithClientAt,
  updatedAt: '2026-10-01T00:00:00.000Z',
});

function Harness({ id }: { id: number }) {
  const detail = useClientDetail({ switchView: () => {}, setClients: () => {} });
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void detail.openClient(client(id) as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!detail.selectedClient || detail.tabLoading) return <div>загрузка</div>;
  return <ClientConceptTab detail={detail} onOpenCanvas={() => {}} />;
}

async function openTab(sharedAt: string | null, id = 7) {
  mockApi.getConceptualization.mockResolvedValue(concept(sharedAt));
  render(<MemoryRouter><Harness id={id} /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Ещё действия' });
}
const toggle = () => screen.getByRole('switch', { name: 'Показать клиенту' });

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe('ConceptShareRow: «Показать клиенту»', () => {
  it('по умолчанию выключен; подпись — что увидит клиент, истоков и задач терапии нет', async () => {
    await openTab(null);
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    const hint = document.getElementById(toggle().getAttribute('aria-describedby')!)!;
    expect(hint.textContent).toMatch(/схемы, режимы, потребности/);
    expect(hint.textContent).toMatch(/Истоки и задачи терапии клиент не увидит/);
  });

  it('включение зовёт PATCH и отражает ответ: тумблер включён, подпись с днём показа, событие { on: true }', async () => {
    await openTab(null);
    mockApi.shareConceptualization.mockResolvedValue({ sharedWithClientAt: '2026-11-06T10:00:00.000Z' });
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle().getAttribute('aria-checked')).toBe('true'));
    expect(mockApi.shareConceptualization).toHaveBeenCalledWith(7, true);
    expect(screen.getByText(/Клиент видит схему случая с 6 ноя/)).toBeTruthy();
    expect(CONCEPT_SHARED_EVENT).toBe('concept_shared');
    expect(mockApi.trackEvent).toHaveBeenCalledWith(CONCEPT_SHARED_EVENT, { on: true });
  });

  it('уже показана — тумблер включён с сервера; выключение — PATCH false и событие { on: false }', async () => {
    await openTab('2026-11-01T10:00:00.000Z');
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    mockApi.shareConceptualization.mockResolvedValue({ sharedWithClientAt: null });
    fireEvent.click(toggle());
    await waitFor(() => expect(toggle().getAttribute('aria-checked')).toBe('false'));
    expect(mockApi.shareConceptualization).toHaveBeenCalledWith(7, false);
    expect(mockApi.trackEvent).toHaveBeenCalledWith(CONCEPT_SHARED_EVENT, { on: false });
  });

  it('отказ сети — строка ошибки, положение прежнее, события нет', async () => {
    await openTab(null);
    mockApi.shareConceptualization.mockRejectedValue(new Error('offline'));
    fireEvent.click(toggle());
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/Не получилось переключить показ/);
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect(mockApi.trackEvent).not.toHaveBeenCalledWith(CONCEPT_SHARED_EVENT, expect.anything());
  });

  it('офлайн-клиент (отрицательный id) — строки нет: показывать некому', async () => {
    await openTab(null, -57);
    expect(screen.queryByRole('switch', { name: 'Показать клиенту' })).toBeNull();
  });
});
