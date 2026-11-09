// @vitest-environment jsdom
// Сбой загрузки концептуализации ≠ «её нет» (docs/open/therapy.md, найдено при разборе
// инцидента 2026-10-26): `openClient` клал `null`, вкладка рисовала пустые поля, а первая
// правка уходила телом со ВСЕМИ полями (пустые — '') и затирала сохранённое на сервере.
// Поверх НАСТОЯЩЕГО useClientDetail (мок только сети): плашка вместо полей, правки закрыты,
// «Повторить» грузит заново, и правка после него несёт сохранённое (сохранил → нашёл).
import { useEffect, useLayoutEffect, useRef } from 'react';
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
import { api, reportClientError } from '../../api';
import { ClientConceptTab } from './ClientConceptTab';
import { useClientDetail } from './useClientDetail';
import type { ClientDetail } from './clientSheetTypes';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};
const SAVED = {
  id: 1, therapistId: 1, clientId: 7, schemaIds: ['abandonment'], modeIds: [],
  earlyExperience: 'детство Анны', unmetNeeds: null, triggers: null, copingStyles: null,
  goals: 'цели Анны', currentProblems: null, modeTransitions: null,
  modeLinks: [], schemaLinks: [], modeMapNodes: [], modeMapEdges: [], history: [],
  updatedAt: new Date().toISOString(),
};

// Хук наружу — для правки мимо разметки (поля закрыты, кнопок правки на экране нет).
// Присвоение — в useLayoutEffect: он идёт в том же коммите, что и DOM. Пассивный useEffect под нагрузкой
// CI отставал: findBy видел плашку раньше, чем эффект обновлял handle, и правка шла через замыкание
// прошлого рендера, где load.failed ещё false (флак run 42317334738, main 3b705b69e).
const handle: { current: ClientDetail | null } = { current: null };
function Harness() {
  const detail = useClientDetail({ switchView: () => {}, setClients: () => {} });
  const opened = useRef(false);
  useLayoutEffect(() => { handle.current = detail; });
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void detail.openClient(CLIENT as never);
  }, [detail]);
  if (!detail.selectedClient || detail.tabLoading) return <div>загрузка</div>;
  return <ClientConceptTab detail={detail} />;
}

const FAILED = /Концептуализация не загрузилась/;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  mockApi.saveConceptualization.mockImplementation(async (_id: number, body: object) => ({ ...SAVED, ...body }));
  mockApi.getConceptualization.mockRejectedValueOnce(new Error('network down'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('ClientConceptTab: концептуализация не загрузилась', () => {
  it('вместо пустых полей — плашка с «Повторить»; правка не уходит на сервер', async () => {
    render(<Harness />);
    expect((await screen.findByRole('alert')).textContent).toMatch(FAILED);
    expect(screen.queryByText('Актуальные схемы')).toBeNull();
    expect(handle.current!.conceptLoad.failed).toBe(true); // handle — того же рендера, что плашка

    vi.useFakeTimers();
    act(() => { handle.current!.patchConcept({ goals: '' }); handle.current!.toggleSchemaId('defectiveness'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(mockApi.saveConceptualization).not.toHaveBeenCalled();
    expect(handle.current!.saveStatus).toBe('idle');
  });

  it('«Повторить» грузит заново; правка после него — патч от загруженной строки, сохранённое не затирается', async () => {
    mockApi.getConceptualization.mockResolvedValueOnce(SAVED);
    render(<Harness />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByText('Актуальные схемы');
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(handle.current!.conceptLoad.failed).toBe(false); // handle — того же рендера, что поля

    vi.useFakeTimers();
    act(() => { handle.current!.patchConcept({ triggers: 'опоздания' }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1);
    const body = mockApi.saveConceptualization.mock.calls[0][1] as Record<string, unknown>;
    expect(body.triggers).toBe('опоздания');
    // Патч от загруженной строки: сохранённые поля не уходят пустыми — они не уходят вовсе.
    expect(body.baseVersion).toBe(SAVED.updatedAt);
    expect(body).not.toHaveProperty('goals');
    expect(body).not.toHaveProperty('earlyExperience');
    expect(body).not.toHaveProperty('schemaIds');
  });

  it('повтор тоже упал — плашка на месте, кнопка снова доступна, сбой ушёл в телеметрию', async () => {
    mockApi.getConceptualization.mockRejectedValueOnce(new Error('network down'));
    render(<Harness />);
    await screen.findByRole('alert');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Повторить' })); });
    expect(screen.getByRole('alert').textContent).toMatch(FAILED);
    expect((screen.getByRole('button', { name: 'Повторить' }) as HTMLButtonElement).disabled).toBe(false);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ message: 'concept reload failed' }));
  });
});
