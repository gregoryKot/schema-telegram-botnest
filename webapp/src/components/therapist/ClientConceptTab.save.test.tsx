// @vitest-environment jsdom
// Issue #879 (шаг A): видимое сохранение на вкладке «Концептуализация» сайта
// поверх НАСТОЯЩЕГО useClientDetail (мок только сети). Правка → «Изменения ещё
// не сохранены» → «Сохраняю…» → «✓ Сохранено в ЧЧ:ММ», и статус НЕ гаснет через
// 3 с (раньше гас через 2 с — терапевт не знал, сохранилось ли). Отказ сети →
// «Не сохранилось» + «Повторить»; повтор зовёт api второй раз и шлёт событие
// concept_save_retry (литерал в хуке равен константе из shared).
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

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
import { CONCEPT_SAVE_RETRY_EVENT } from '../../../../shared/src/share/analytics';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};

const concept = (patch: Record<string, unknown> = {}) => ({
  id: 1, therapistId: 1, clientId: 7, schemaIds: [], modeIds: [],
  earlyExperience: null, unmetNeeds: null, triggers: null, copingStyles: null,
  goals: null, currentProblems: null, modeTransitions: null,
  modeLinks: [], schemaLinks: [], modeMapNodes: [], modeMapEdges: [], history: [],
  // Момент сохранения — «сегодня»: статус пишет «в ЧЧ:ММ», для другого дня — с датой
  // (это проверяет SaveStatusLine.test.tsx).
  updatedAt: new Date().toISOString(),
  ...patch,
});

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

// Открывает вкладку на реальных таймерах (загрузка — цепочка await), затем
// включает фейковые: debounce автосохранения 700 мс и «не гаснет 3 с» отматываются явно.
async function openTab() {
  mockApi.getConceptualization.mockResolvedValue(concept());
  render(<Harness />);
  await screen.findByText('Актуальные схемы');
  vi.useFakeTimers();
}

const statusText = () => screen.getByRole('status').textContent;

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

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('ClientConceptTab: видимое сохранение (#879)', () => {
  it('правка → «Изменения ещё не сохранены» → «Сохраняю…» → «✓ Сохранено в ЧЧ:ММ», и статус не гаснет', async () => {
    let resolveSave: (v: unknown) => void = () => {};
    mockApi.saveConceptualization.mockImplementation(
      () => new Promise((resolve) => { resolveSave = resolve; }),
    );
    await openTab();
    expect(statusText()).toBe('');

    fireEvent.click(screen.getByText('Эмоциональная депривация'));
    expect(statusText()).toBe('Изменения ещё не сохранены');

    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1);
    expect(statusText()).toBe('Сохраняю…');

    await act(async () => { resolveSave(concept({ schemaIds: ['emotional_deprivation'] })); });
    expect(statusText()).toMatch(/^✓ Сохранено в \d{2}:\d{2}$/);

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(statusText()).toMatch(/^✓ Сохранено в \d{2}:\d{2}$/);
  });

  it('отказ сети → «Не сохранилось» + «Повторить»; повтор зовёт api второй раз и шлёт concept_save_retry', async () => {
    mockApi.saveConceptualization.mockRejectedValueOnce(new Error('network down'));
    await openTab();

    fireEvent.click(screen.getByText('Эмоциональная депривация'));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toContain('Не сохранилось');
    expect(screen.queryByRole('status')).toBeNull();

    mockApi.saveConceptualization.mockResolvedValue(concept({ schemaIds: ['emotional_deprivation'] }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    });
    expect(mockApi.saveConceptualization).toHaveBeenCalledTimes(2);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('concept_save_retry');
    expect(CONCEPT_SAVE_RETRY_EVENT).toBe('concept_save_retry');
    expect(statusText()).toMatch(/^✓ Сохранено в \d{2}:\d{2}$/);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
