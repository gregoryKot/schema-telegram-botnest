// @vitest-environment jsdom
// #963, «сохранил → нашёл» между вкладками: холст «Графических карт» дописал
// режим в концептуализацию (append на сервере) → вкладка «Концептуализация»
// того же клиента, загруженная раньше, показывает его, а первая же правка
// текста уходит с ним, а не со старыми modeIds (иначе стёрла бы дописанное).
// Холст сообщает о записи тем же announceConceptAppended, что и здесь
// (useConceptBackSync, проверяет modeMap/useConceptSync.test.tsx).
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(), getTherapistNotes: vi.fn(), getConceptualization: vi.fn(),
    getTherapyClientData: vi.fn(), getClientSchemaNotes: vi.fn(), getClientModeNotes: vi.fn(),
    getTherapyClientHistory: vi.fn(), getClientDiary: vi.fn(), saveConceptualization: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { ClientConceptTab } from './ClientConceptTab';
import { useClientDetail } from './useClientDetail';
import { announceConceptAppended } from '../modeMap/conceptAppendedEvent';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null, todayIndex: null,
  recentIndexHistory: [], relationCreatedAt: '2026-01-01', therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};
const concept = (patch: Record<string, unknown> = {}) => ({
  id: 1, therapistId: 1, clientId: 7, schemaIds: [], modeIds: [], earlyExperience: null, unmetNeeds: null,
  triggers: null, copingStyles: null, goals: null, currentProblems: null, modeTransitions: null,
  modeLinks: [], schemaLinks: [], modeMapNodes: [], modeMapEdges: [], history: [], updatedAt: new Date().toISOString(), ...patch,
});
// Без режимов вкладка открывается на полях, а не на виде «Схема» (useConceptView).
const APPENDED = concept({ modeIds: ['demanding_critic'] });

function Harness() {
  const detail = useClientDetail({ switchView: () => {}, setClients: () => {} });
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

async function openTab() {
  mockApi.getConceptualization.mockResolvedValue(concept());
  render(<Harness />);
  await screen.findByText('0 в работе');
  vi.useFakeTimers();
}
const typeText = (value: string) => fireEvent.change(document.querySelector('textarea')!, { target: { value } });
const lastBody = () => mockApi.saveConceptualization.mock.calls.at(-1)?.[1] as { modeIds?: string[]; schemaIds?: string[]; baseVersion?: string | null };

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of ['getTherapyTasksForClient', 'getClientSchemaNotes', 'getClientModeNotes', 'getTherapyClientHistory', 'getClientDiary']) {
    mockApi[k].mockResolvedValue([]);
  }
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.saveConceptualization.mockImplementation((_id: unknown, body: object) => Promise.resolve(concept(body as Record<string, unknown>)));
});
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe('ClientConceptTab: дописанное холстом (#963)', () => {
  it('холст дописал режим → вкладка показывает его → правка текста уходит с ним', async () => {
    await openTab();
    act(() => announceConceptAppended({ clientId: 7, concept: APPENDED as never }));
    expect(screen.getByText('1 в работе')).toBeTruthy();
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled(); // сама запись холста повторно не сохраняется

    typeText('Новый текст');
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1);
    // Патч от версии ответа холста: режимы не менялись — не уходят и дописанное не стирают.
    expect(lastBody().baseVersion).toBe(APPENDED.updatedAt);
    expect(lastBody().modeIds).toBeUndefined();
    expect(Object.values(lastBody())).toContain('Новый текст');
  });

  it('неотправленная правка схем не теряется и уходит вместе с режимом с холста', async () => {
    await openTab();
    fireEvent.click(screen.getByRole('button', { name: 'Изменить: Актуальные схемы' })); // пустой выбор свёрнут (b33)
    fireEvent.click(screen.getByText('Эмоциональная депривация')); // правка ждёт 700 мс
    act(() => announceConceptAppended({ clientId: 7, concept: APPENDED as never }));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1);
    expect(lastBody().schemaIds).toEqual(['emotional_deprivation']);
    expect(lastBody().modeIds).toBeUndefined(); // режим холста уже на сервере, патч его не трогает
    expect(lastBody().baseVersion).toBe(APPENDED.updatedAt);
  });

  it('запись холста у другого клиента вкладку не трогает', async () => {
    await openTab();
    act(() => announceConceptAppended({ clientId: 8, concept: APPENDED as never }));
    expect(screen.getByText('0 в работе')).toBeTruthy();
  });
});
